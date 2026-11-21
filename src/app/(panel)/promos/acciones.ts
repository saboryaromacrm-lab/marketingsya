'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { encolarExportacion } from '@/lib/piezas/exportar'
import { cargarPieza } from '@/lib/publicaciones/piezas'
import { cargarPromo, filasDelErp, planDePlacas, rutaPlaca } from '@/lib/promos/datos'
import { leerFiltros } from '@/lib/catalogo/filtros'
import { buscarProductos } from '@/lib/catalogo/listado'
import { detalleBase, pesosPromo } from '@/lib/promos/calculo'
import { urlMedia } from '@/lib/media'
import { disenoSiguiente, infoProductos, placasDe, type DatosEditor, type FilaEditor } from '@/lib/promos/editor'
import { esFecha, hoyFormosa, sumarDias } from '@/lib/promos/fechas'
import { leerConfig } from '@/lib/configuracion'
import { ANIMACION_INICIAL, limpiarAnimacion } from '@/lib/video/tipos'
import { formatosNuevaPromo } from '@/lib/video/formatos'

const { promos, promoFilas, seleccion, listas, productos } = esquema
const MAX_FILAS = 60
const MAX_PRODUCTOS_FILA = 24

type Resultado<T> = ({ ok: true } & T) | { error: string }

// ---------- validación (todo lo que llega del navegador se revisa acá) ----------
const entero = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null)

async function validar(d: DatosEditor): Promise<DatosEditor | string> {
  if (!esFecha(d.desde) || !esFecha(d.hasta)) return 'Revisá las fechas de vigencia.'
  if (d.hasta < d.desde) return 'La vigencia termina antes de empezar.'
  const [lista] = await db.select({ id: listas.id }).from(listas).where(eq(listas.id, Number(d.listaId)))
  if (!lista) return 'Esa lista de precios no existe.'
  if (!Array.isArray(d.filas) || d.filas.length > MAX_FILAS) return `Hasta ${MAX_FILAS} filas por promo.`
  const ids = [...new Set(d.filas.flatMap((f) => (Array.isArray(f.productos) ? f.productos.map((p) => p.id) : [])))]
  const existentes = new Set(ids.length ? (await db.select({ id: productos.id }).from(productos).where(inArray(productos.id, ids))).map((p) => p.id) : [])
  const filas: FilaEditor[] = []
  for (const f of d.filas) {
    const tipo = (['producto', 'variantes', 'grupo'] as const).find((t) => t === f.tipo)
    const items = (Array.isArray(f.productos) ? f.productos : [])
      .filter((p) => existentes.has(p.id))
      .slice(0, MAX_PRODUCTOS_FILA)
      .map((p) => ({ id: p.id, nombre: texto(p.nombre, 40), tam: texto(p.tam, 20), presentacion: texto(p.presentacion, 20) }))
    if (!tipo || !items.length) continue
    const t = tipo === 'producto' && items.length > 1 ? 'grupo' : tipo
    const descuento = typeof f.descuento === 'number' && f.descuento >= 0 && f.descuento <= 90 ? Math.round(f.descuento * 100) / 100 : null
    filas.push({
      tipo: t,
      titulo: texto(f.titulo, 60),
      descuento,
      cantidadMinima: entero(f.cantidadMinima, 1, 999),
      precioFijo: f.origen === 'erp' && typeof f.precioFijo === 'number' && f.precioFijo > 0 ? f.precioFijo : null,
      origen: f.origen === 'erp' ? 'erp' : 'manual',
      productos: items,
    })
  }
  return {
    titulo: texto(d.titulo, 24) ?? 'PROMOCIONES',
    desde: d.desde,
    hasta: d.hasta,
    listaId: lista.id,
    diseno: d.diseno === '2' ? '2' : '1',
    formatos: { historia: !!d.formatos?.historia, feed: !!d.formatos?.feed, uno: !!d.formatos?.uno, reel: !!d.formatos?.reel, historiaVideo: !!d.formatos?.historiaVideo, videoFeed: !!d.formatos?.videoFeed },
    animacion: limpiarAnimacion(d.animacion),
    textoPosteo: typeof d.textoPosteo === 'string' && d.textoPosteo.trim() ? d.textoPosteo.slice(0, 2200) : null,
    filas,
  }
}

async function guardarFilas(promoId: number, filas: FilaEditor[]) {
  await db.transaction(async (tx) => {
    await tx.delete(promoFilas).where(eq(promoFilas.promoId, promoId))
    if (filas.length) await tx.insert(promoFilas).values(filas.map((f, orden) => ({ ...f, promoId, orden })))
    await tx.update(promos).set({ actualizadoEn: new Date() }).where(eq(promos.id, promoId))
  })
}

// ---------- crear ----------

/** Nueva promo con lo elegido en el catálogo (un producto por fila, 10 % de entrada) + las promos del ERP. */
export async function crearPromoDesdeSeleccion() {
  const config = await leerConfig()
  const elegidos = await db.select({ id: seleccion.productoId }).from(seleccion).orderBy(asc(seleccion.agregadoEn))
  const erp = await filasDelErp()
  const enErp = new Set(erp.flatMap((f) => f.productos.map((p) => p.id)))
  const filas: FilaEditor[] = [
    ...elegidos.filter((e) => !enErp.has(e.id)).map((e): FilaEditor => ({ tipo: 'producto', titulo: null, descuento: config.piezas.descuento, cantidadMinima: null, precioFijo: null, origen: 'manual', productos: [{ id: e.id }] })),
    ...erp.map((f): FilaEditor => ({ ...f, titulo: null, descuento: null, origen: 'erp' })),
  ]
  const hoy = hoyFormosa()
  const [{ id }] = await db.insert(promos).values({ desde: hoy, hasta: sumarDias(hoy, config.piezas.vigenciaDias), diseno: await disenoSiguiente(), listaId: config.piezas.listaId, formatos: formatosNuevaPromo(config), animacion: { ...ANIMACION_INICIAL, ...config.creacion.animacion } }).returning({ id: promos.id })
  await guardarFilas(id, filas)
  await db.delete(seleccion)
  revalidatePath('/', 'layout')
  redirect(`/promos/${id}`)
}

// ---------- editar ----------

export async function guardarPromo(id: number, datos: DatosEditor): Promise<Resultado<{ placas: Awaited<ReturnType<typeof placasDe>> }>> {
  const v = await validar(datos)
  if (typeof v === 'string') return { error: v }
  const { filas, ...resto } = v
  const [p] = await db.update(promos).set({ ...resto, actualizadoEn: new Date() }).where(eq(promos.id, id)).returning({ id: promos.id })
  if (!p) return { error: 'Esa promo ya no existe.' }
  await guardarFilas(id, filas)
  revalidatePath('/promos')
  return { ok: true, placas: await placasDe(id) }
}

/** Filas nuevas para sumar al editor: los elegidos del catálogo, o las promos del ERP que falten. */
export async function filasParaSumar(origen: 'seleccion' | 'erp', yaEstan: number[]): Promise<{ filas: FilaEditor[]; info: Awaited<ReturnType<typeof infoProductos>> }> {
  const presentes = new Set(yaEstan)
  let filas: FilaEditor[]
  if (origen === 'erp') {
    filas = (await filasDelErp()).filter((f) => !presentes.has(f.productos[0].id)).map((f) => ({ ...f, titulo: null, descuento: null, origen: 'erp' as const }))
  } else {
    const elegidos = await db.select({ id: seleccion.productoId }).from(seleccion).orderBy(asc(seleccion.agregadoEn))
    const { descuento } = (await leerConfig()).piezas
    filas = elegidos.filter((e) => !presentes.has(e.id)).map((e) => ({ tipo: 'producto' as const, titulo: null, descuento, cantidadMinima: null, precioFijo: null, origen: 'manual' as const, productos: [{ id: e.id }] }))
    await db.delete(seleccion)
    revalidatePath('/', 'layout')
  }
  return { filas, info: await infoProductos(filas.flatMap((f) => f.productos.map((p) => p.id))) }
}

export async function duplicarPromo(id: number) {
  const d = await cargarPromo(id)
  if (!d) return
  const hoy = hoyFormosa()
  const { id: _i, creadoEn: _c, actualizadoEn: _a, exportacionId: _e, ...resto } = d.promo
  const [{ id: nuevo }] = await db.insert(promos).values({ ...resto, desde: hoy, hasta: sumarDias(hoy, (await leerConfig()).piezas.vigenciaDias) }).returning({ id: promos.id })
  await guardarFilas(nuevo, d.filas.map(({ id: _x, promoId: _p, orden: _o, ...f }) => f))
  redirect(`/promos/${nuevo}`)
}

export async function borrarPromo(id: number) {
  await db.delete(promos).where(eq(promos.id, id))
  revalidatePath('/promos')
  redirect('/promos')
}

export async function exportarPromo(id: number): Promise<Resultado<{ exportacionId: number; placas: number }>> {
  const d = await cargarPromo(id)
  if (!d) return { error: 'Esa promo ya no existe.' }
  // Nunca sale una placa con «Sin foto»
  const sinFoto = [...d.productos.values()].filter((p) => !p.foto)
  if (sinFoto.length) return { error: `No se puede exportar: ${sinFoto.map((p) => `«${p.nombre}»`).join(', ')} no ${sinFoto.length === 1 ? 'tiene' : 'tienen'} foto.` }
  const placas = planDePlacas(d)
  if (!placas.length) return { error: 'No hay nada para exportar: sumá productos y elegí al menos un formato.' }
  try {
    const exportacionId = await encolarExportacion('promo', placas.map((p) => rutaPlaca(id, p)), id, (await cargarPieza('promo', id))?.huella ?? null)
    await db.update(promos).set({ exportacionId }).where(eq(promos.id, id))
    return { ok: true, exportacionId, placas: placas.length }
  } catch {
    return { error: 'No se pudo iniciar la exportación.' }
  }
}

// ---------- buscador del editor ----------

import type { ResultadoBusqueda } from '@/components/piezas/Editor'
export type { ResultadoBusqueda }

/** Productos para sumar a la promo: solo los que pueden ir en piezas (activos, con foto y no excluidos). */
export async function buscarParaPromo(q: string, listaId: number): Promise<{ resultados: ResultadoBusqueda[]; aproximada: boolean }> {
  const texto = typeof q === 'string' ? q.trim().slice(0, 80) : ''
  if (texto.length < 2) return { resultados: [], aproximada: false }
  const f = leerFiltros({ q: texto, foto: 'con', piezas: 'si', lista: String(Number(listaId) || 3) })
  const r = await buscarProductos(f)
  const ids = r.filas.slice(0, 8).map((p) => p.id)
  const erp = ids.length ? await db.select({ id: productos.id, erp: productos.erp, tipo: productos.tipo }).from(productos).where(inArray(productos.id, ids)) : []
  const porId = new Map(erp.map((p) => [p.id, p]))
  return {
    aproximada: r.aproximada,
    resultados: r.filas.slice(0, 8).map((p) => {
      const x = porId.get(p.id)
      const det = x ? detalleBase(x.erp, x.tipo === 'granel', f.lista) : null
      return { id: p.id, nombre: p.nombrePiezas || p.nombreSugerido, foto: urlMedia(p.foto!), precio: det ? `${pesosPromo(det.precio)} ${det.unidad}` : null }
    }),
  }
}

/** Datos para mostrar en el editor los productos que se acaban de sumar (solo los que pueden ir en piezas). */
export async function infoParaSumar(ids: number[]) {
  const limpios = (Array.isArray(ids) ? ids : []).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50)
  const info = await infoProductos(limpios)
  return Object.fromEntries(Object.entries(info).filter(([, p]) => p.foto))
}
