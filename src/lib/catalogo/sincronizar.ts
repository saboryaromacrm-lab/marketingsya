import 'server-only'
import { and, desc, eq, inArray, isNotNull, lt, notInArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { borrarMedia, descargarImagen, ErrorDeDescarga } from '@/lib/media'
import { Limitador } from '@/lib/limitador'
import { descargarCatalogo } from './api'
import { compararProducto, huella, type Cambio } from './comparar'
import { normalizarCatalogo, VERSION_NORMALIZACION } from './normalizar'
import { LISTA_MINORISTA, precioDeLista } from './precios'
import { textoDeBusqueda } from './busqueda'
import type { MarcaNormalizada, ProductoNormalizado } from './tipos'
import type { PreciosPorLista, ResumenSincronizacion } from '@/lib/db/esquema'

const { productos, marcas, listas, sucursales, sincronizaciones, sincronizacionCambios } = esquema

// Si el ERP devuelve menos de la mitad de los productos que tenemos, algo anda mal
// (respuesta cortada, error del ERP): se frena antes de dar de baja la mitad del catálogo.
const PROPORCION_MINIMA = 0.5
const MESES_DE_HISTORIAL = 6
const DESCARGAS_EN_PARALELO = 4
// El ERP es el servidor del negocio y limita los pedidos (responde 429 si se le pide mucho).
// Se descarga despacio y, si igual frena, se espera y se reintenta.
const PEDIDOS_POR_SEGUNDO = 8
const ESPERA_POR_DEFECTO_429 = 20
const REINTENTOS_429 = 5

type Avance = (etapa: string, avance: number) => Promise<void>

function resumenVacio(): ResumenSincronizacion {
  return { productos: 0, altas: 0, bajas: 0, reactivados: 0, modificados: 0, precios: 0, fotos: 0, fotosDescargadas: 0, fotosConError: 0, marcas: 0, descartados: 0 }
}

function enTandas<T>(items: T[], tamano: number): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < items.length; i += tamano) tandas.push(items.slice(i, i + tamano))
  return tandas
}

async function enParalelo<T>(items: T[], cantidad: number, fn: (item: T) => Promise<void>) {
  let siguiente = 0
  const trabajador = async () => {
    while (siguiente < items.length) await fn(items[siguiente++])
  }
  await Promise.all(Array.from({ length: Math.min(cantidad, items.length) }, trabajador))
}

// Columnas que se pisan con lo que viene del ERP. nombrePiezas y la foto copiada NO están:
// las maneja Lucas o el paso de fotos.
const excluido = (columna: string) => sql.raw(`excluded."${columna}"`)

type Contexto = { marcasValidas: Set<number>; nombreMarca: Map<number, string>; idsListas: number[] }

// Campos que se calculan a partir del ERP pero no forman parte de la huella:
// si cambian las reglas (o el nombre de una marca), se recalculan sin contar como cambio del ERP.
function derivados(p: ProductoNormalizado, ctx: Contexto) {
  const preciosLista: PreciosPorLista = {}
  for (const id of ctx.idsListas) {
    const x = precioDeLista(p, id)
    if (x) preciosLista[id] = { precio: x.precio, unidades: x.unidades, presentacion: x.presentacion }
  }
  return {
    nombreSugerido: p.nombreSugerido,
    busqueda: textoDeBusqueda(p, p.marcaId ? (ctx.nombreMarca.get(p.marcaId) ?? null) : null),
    preciosLista,
  }
}

function filaProducto(p: ProductoNormalizado, ctx: Contexto) {
  const { marcasValidas } = ctx
  return {
    ...derivados(p, ctx),
    id: p.id,
    nombre: p.nombre,
    nombreErp: p.nombreErp,
    // Si el producto apunta a una marca que el ERP no listó, se guarda sin marca (el dato queda en erp).
    marcaId: p.marcaId && marcasValidas.has(p.marcaId) ? p.marcaId : null,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    etiquetas: p.etiquetas,
    tipo: p.tipo,
    estado: p.estado,
    codigo: p.codigo,
    codigoBarras: p.codigoBarras,
    precioMinorista: precioDeLista(p, LISTA_MINORISTA)?.precio ?? null,
    erp: p,
    huella: huella(p),
    imagenErpVersion: p.imagen?.version ?? null,
    dadoDeBaja: false,
    bajaEn: null,
    actualizadoEn: new Date(),
  }
}

/** Aplica el catálogo a la base en una sola transacción. Devuelve el resumen y los cambios. */
async function aplicarCatalogo(sincronizacionId: number, cat: ReturnType<typeof normalizarCatalogo>, resumen: ResumenSincronizacion) {
  const listasPorId = new Map(cat.listas.map((l) => [l.id, l.nombre]))

  await db.transaction(async (tx) => {
    const cambios: (typeof sincronizacionCambios.$inferInsert)[] = []
    const anotar = (entidad: 'producto' | 'marca', id: number, nombre: string, c: Cambio) =>
      cambios.push({ sincronizacionId, entidad, entidadId: id, nombre, tipo: c.tipo, antes: c.antes ?? null, despues: c.despues ?? null })

    // Sucursales y listas: tablas chicas, se pisan siempre.
    for (const s of cat.sucursales) {
      await tx.insert(sucursales).values(s).onConflictDoUpdate({ target: sucursales.id, set: { nombre: s.nombre } })
    }
    for (const l of cat.listas) {
      await tx.insert(listas).values(l).onConflictDoUpdate({ target: listas.id, set: { nombre: l.nombre, modalidad: l.modalidad, orden: l.orden } })
    }

    // ---- Marcas ----
    const marcasGuardadas = new Map((await tx.select().from(marcas)).map((m) => [m.id, m]))
    const marcasNuevas: MarcaNormalizada[] = []
    for (const m of cat.marcas) {
      const antes = marcasGuardadas.get(m.id)
      const h = huella(m)
      if (antes && antes.huella === h && !antes.dadaDeBaja) continue
      marcasNuevas.push(m)
      if (!antes) continue // las altas de marcas no se anotan: se ven por sus productos
      if (antes.nombre !== m.nombre) anotar('marca', m.id, m.nombre, { tipo: 'nombre', antes: antes.nombre, despues: m.nombre })
      if ((antes.logoErpVersion ?? null) !== (m.logo?.version ?? null)) anotar('marca', m.id, m.nombre, { tipo: 'foto', antes: antes.logoErpVersion, despues: m.logo?.version ?? null })
      if (antes.dadaDeBaja) anotar('marca', m.id, m.nombre, { tipo: 'reactivado', antes: null, despues: null })
    }
    for (const tanda of enTandas(marcasNuevas, 200)) {
      await tx
        .insert(marcas)
        .values(tanda.map((m) => ({ id: m.id, nombre: m.nombre, nombreErp: m.nombreErp, logoErpUrl: m.logo?.url ?? null, logoErpVersion: m.logo?.version ?? null, cantidadProductos: m.cantidadProductos, huella: huella(m), dadaDeBaja: false, actualizadoEn: new Date() })))
        .onConflictDoUpdate({
          target: marcas.id,
          set: { nombre: excluido('nombre'), nombreErp: excluido('nombre_erp'), logoErpUrl: excluido('logo_erp_url'), logoErpVersion: excluido('logo_erp_version'), cantidadProductos: excluido('cantidad_productos'), huella: excluido('huella'), dadaDeBaja: sql`false`, actualizadoEn: sql`now()` },
        })
    }
    const idsMarcas = cat.marcas.map((m) => m.id)
    const marcasDeBaja = [...marcasGuardadas.values()].filter((m) => !m.dadaDeBaja && !idsMarcas.includes(m.id))
    if (marcasDeBaja.length) {
      await tx.update(marcas).set({ dadaDeBaja: true, actualizadoEn: new Date() }).where(inArray(marcas.id, marcasDeBaja.map((m) => m.id)))
      for (const m of marcasDeBaja) anotar('marca', m.id, m.nombre, { tipo: 'baja', antes: null, despues: null })
    }
    resumen.marcas = cambios.length

    // ---- Productos ----
    const guardados = new Map(
      (
        await tx
          .select({ id: productos.id, nombre: productos.nombre, erp: productos.erp, huella: productos.huella, nombreSugerido: productos.nombreSugerido, busqueda: productos.busqueda, preciosLista: productos.preciosLista, dadoDeBaja: productos.dadoDeBaja })
          .from(productos)
      ).map((p) => [p.id, p]),
    )
    const ctx: Contexto = {
      marcasValidas: new Set(idsMarcas),
      nombreMarca: new Map(cat.marcas.map((m) => [m.id, m.nombre])),
      idsListas: cat.listas.map((l) => l.id),
    }
    const aGuardar: ReturnType<typeof filaProducto>[] = []
    const soloDerivados: ({ id: number } & ReturnType<typeof derivados>)[] = []

    for (const p of cat.productos) {
      const antes = guardados.get(p.id)
      if (!antes) {
        resumen.altas++
        anotar('producto', p.id, p.nombre, { tipo: 'alta', antes: null, despues: { precio: precioDeLista(p, LISTA_MINORISTA)?.precio ?? null } })
        aGuardar.push(filaProducto(p, ctx))
        continue
      }
      const reactivado = antes.dadoDeBaja
      const distintos = antes.huella !== huella(p)
      if (reactivado) {
        resumen.reactivados++
        anotar('producto', p.id, p.nombre, { tipo: 'reactivado', antes: null, despues: null })
      }
      if (distintos) {
        const lista = compararProducto(antes.erp, p, listasPorId)
        if (lista.length) resumen.modificados++
        if (lista.some((c) => c.tipo === 'precio')) resumen.precios++
        if (lista.some((c) => c.tipo === 'foto')) resumen.fotos++
        for (const c of lista) anotar('producto', p.id, p.nombre, c)
      }
      if (reactivado || distintos) aGuardar.push(filaProducto(p, ctx))
      else {
        const d = derivados(p, ctx)
        const igual = d.nombreSugerido === antes.nombreSugerido && d.busqueda === antes.busqueda && JSON.stringify(d.preciosLista) === JSON.stringify(antes.preciosLista)
        if (!igual) soloDerivados.push({ id: p.id, ...d })
      }
    }

    for (const tanda of enTandas(aGuardar, 200)) {
      await tx
        .insert(productos)
        .values(tanda)
        .onConflictDoUpdate({
          target: productos.id,
          set: {
            nombre: excluido('nombre'), nombreErp: excluido('nombre_erp'), nombreSugerido: excluido('nombre_sugerido'),
            busqueda: excluido('busqueda'), preciosLista: excluido('precios_lista'),
            marcaId: excluido('marca_id'), categoria: excluido('categoria'), subcategoria: excluido('subcategoria'),
            etiquetas: excluido('etiquetas'), tipo: excluido('tipo'), estado: excluido('estado'), codigo: excluido('codigo'),
            codigoBarras: excluido('codigo_barras'), precioMinorista: excluido('precio_minorista'), erp: excluido('erp'),
            huella: excluido('huella'), imagenErpVersion: excluido('imagen_erp_version'),
            dadoDeBaja: sql`false`, bajaEn: sql`null`, actualizadoEn: sql`now()`,
          },
        })
    }

    // Bajas: estaban y ya no vienen. No se borran (pueden estar en piezas viejas).
    const idsNuevos = new Set(cat.productos.map((p) => p.id))
    // Sus derivados también se mantienen al día, para poder buscarlos en «Dados de baja».
    for (const antes of guardados.values()) {
      if (idsNuevos.has(antes.id)) continue
      const d = derivados(antes.erp, ctx)
      if (d.busqueda !== antes.busqueda || d.nombreSugerido !== antes.nombreSugerido || JSON.stringify(d.preciosLista) !== JSON.stringify(antes.preciosLista)) {
        soloDerivados.push({ id: antes.id, ...d })
      }
    }
    const deBaja = [...guardados.values()].filter((p) => !p.dadoDeBaja && !idsNuevos.has(p.id))
    if (deBaja.length) {
      await tx.update(productos).set({ dadoDeBaja: true, bajaEn: new Date(), actualizadoEn: new Date() }).where(inArray(productos.id, deBaja.map((p) => p.id)))
      for (const p of deBaja) anotar('producto', p.id, p.nombre, { tipo: 'baja', antes: null, despues: null })
      resumen.bajas = deBaja.length
    }

    // Reglas nuevas o marca renombrada: se recalculan los derivados sin contarlo como cambio del ERP.
    for (const { id, ...d } of soloDerivados) await tx.update(productos).set(d).where(eq(productos.id, id))

    for (const tanda of enTandas(cambios, 500)) await tx.insert(sincronizacionCambios).values(tanda)
  })
}

/**
 * Copia a nuestro servidor las fotos y logos que faltan o cambiaron.
 * Una foto que falla no frena la sincronización: queda la anterior y se reintenta la próxima vez.
 */
async function copiarFotos(resumen: ResumenSincronizacion, avance: Avance) {
  type Tarea = { tabla: 'producto' | 'marca'; id: number; url: string | null; version: string | null; archivo: string | null }
  const tareas: Tarea[] = []
  const pendiente = (t: Tarea) => (t.url ? !t.archivo || !t.archivo.includes(`-${t.version}.`) : !!t.archivo)

  const ps = await db.select({ id: productos.id, erp: productos.erp, archivo: productos.imagenArchivo }).from(productos).where(eq(productos.dadoDeBaja, false))
  for (const p of ps) tareas.push({ tabla: 'producto', id: p.id, url: p.erp.imagen?.url ?? null, version: p.erp.imagen?.version ?? null, archivo: p.archivo })
  const ms = await db.select({ id: marcas.id, url: marcas.logoErpUrl, version: marcas.logoErpVersion, archivo: marcas.logoArchivo }).from(marcas).where(eq(marcas.dadaDeBaja, false))
  for (const m of ms) tareas.push({ tabla: 'marca', ...m })

  const pendientes = tareas.filter(pendiente)
  const limitador = new Limitador(1000 / PEDIDOS_POR_SEGUNDO)
  const descargar = async (url: string, destino: string): Promise<string> => {
    for (let intento = 0; ; intento++) {
      await limitador.turno()
      try {
        return await descargarImagen(url, destino)
      } catch (e) {
        if (!(e instanceof ErrorDeDescarga) || e.estado !== 429 || intento >= REINTENTOS_429) throw e
        limitador.pausar(e.esperarSegundos ?? ESPERA_POR_DEFECTO_429)
        await avance('El ERP pidió esperar un momento, sigue enseguida', 40 + Math.round((hechas / pendientes.length) * 58))
      }
    }
  }
  let hechas = 0
  let ultimoAviso = 0
  await enParalelo(pendientes, DESCARGAS_EN_PARALELO, async (t) => {
    try {
      let nuevo: string | null = null
      if (t.url) {
        const carpeta = t.tabla === 'producto' ? 'productos' : 'marcas'
        nuevo = await descargar(t.url, `erp/${carpeta}/${t.id}-${t.version}`)
        resumen.fotosDescargadas++
      }
      if (t.tabla === 'producto') await db.update(productos).set({ imagenArchivo: nuevo }).where(eq(productos.id, t.id))
      else await db.update(marcas).set({ logoArchivo: nuevo }).where(eq(marcas.id, t.id))
      if (t.archivo && t.archivo !== nuevo) await borrarMedia(t.archivo)
    } catch (e) {
      resumen.fotosConError++
      console.warn(`[sincronizacion] foto de ${t.tabla} ${t.id}: ${e instanceof Error ? e.message : e}`)
    }
    hechas++
    if (Date.now() - ultimoAviso > 1000 || hechas === pendientes.length) {
      ultimoAviso = Date.now()
      await avance(`Copiando fotos (${hechas.toLocaleString('es-AR')} de ${pendientes.length.toLocaleString('es-AR')})`, 40 + Math.round((hechas / pendientes.length) * 58))
    }
  })
}

export async function ejecutarSincronizacion(id: number) {
  const resumen = resumenVacio()
  const avance: Avance = async (etapa, porcentaje) => {
    await db.update(sincronizaciones).set({ etapa, avance: porcentaje }).where(eq(sincronizaciones.id, id))
  }

  try {
    await db.update(sincronizaciones).set({ estado: 'corriendo', iniciadaEn: new Date(), etapa: 'Descargando el catálogo del ERP', avance: 5 }).where(eq(sincronizaciones.id, id))

    // El ETag de la última sincronización buena: si el catálogo no cambió, el ERP responde 304.
    const [anterior] = await db
      .select({ etag: sincronizaciones.etag })
      .from(sincronizaciones)
      .where(and(inArray(sincronizaciones.estado, ['ok', 'sin_cambios']), isNotNull(sincronizaciones.etag)))
      .orderBy(desc(sincronizaciones.id))
      .limit(1)
    // Se guarda «v<versión de reglas>:<ETag>». Si cambiaron las reglas, no se manda el ETag y se reprocesa todo.
    const prefijo = `v${VERSION_NORMALIZACION}:`
    const etagAnterior = anterior?.etag?.startsWith(prefijo) ? anterior.etag.slice(prefijo.length) : null
    const descarga = await descargarCatalogo(etagAnterior)

    let estado: 'ok' | 'sin_cambios' = 'sin_cambios'
    let etag = anterior?.etag ?? null
    let generadoErp: Date | null = null

    if (!descarga.sinCambios) {
      await avance('Revisando los productos', 15)
      const cat = normalizarCatalogo(descarga.datos)
      resumen.productos = cat.productos.length
      resumen.descartados = cat.descartados

      const [{ activos }] = await db.select({ activos: sql<number>`count(*)::int` }).from(productos).where(eq(productos.dadoDeBaja, false))
      if (activos > 100 && cat.productos.length < activos * PROPORCION_MINIMA) {
        throw new Error(`El ERP devolvió ${cat.productos.length} productos y acá hay ${activos}. No se aplicó nada para no dar de baja productos por error.`)
      }

      await avance('Guardando los cambios', 25)
      await aplicarCatalogo(id, cat, resumen)
      etag = descarga.etag ? prefijo + descarga.etag : null
      generadoErp = cat.generado
      const huboCambios = resumen.altas + resumen.bajas + resumen.reactivados + resumen.modificados + resumen.marcas > 0
      estado = huboCambios ? 'ok' : 'sin_cambios'
    } else {
      const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(productos).where(eq(productos.dadoDeBaja, false))
      resumen.productos = total
    }

    // Las fotos se revisan siempre: así se reintentan las que fallaron la vez anterior.
    await avance('Revisando las fotos', 40)
    await copiarFotos(resumen, avance)

    await db
      .update(sincronizaciones)
      .set({ estado, etag, generadoErp, resumen, etapa: null, avance: 100, terminadaEn: new Date() })
      .where(eq(sincronizaciones.id, id))

    // Historial: se guardan 6 meses.
    await db
      .delete(sincronizaciones)
      .where(and(lt(sincronizaciones.creadoEn, sql`now() - make_interval(months => ${MESES_DE_HISTORIAL})`), notInArray(sincronizaciones.estado, ['en_cola', 'corriendo'])))
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error(`[sincronizacion ${id}]`, e)
    await db
      .update(sincronizaciones)
      .set({ estado: 'error', error: mensaje, resumen, etapa: null, terminadaEn: new Date() })
      .where(eq(sincronizaciones.id, id))
  }
}
