'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import type { EstiloCarrusel, FormatosCarrusel } from '@/lib/db/esquema'
import { leerConfig } from '@/lib/configuracion'
import { datosIniciales, ESTILOS, type DatosLanzamiento, type DatosNutriofertas } from '@/lib/carruseles/tipos'
import { hoyFormosa, sumarDias } from '@/lib/promos/fechas'
import { proximasFechas } from '@/lib/ia/fechas-especiales'
import { disenoSiguiente, type FilaEditor } from '@/lib/promos/editor'
import { filasDelErp } from '@/lib/promos/datos'
import { ANIMACION_INICIAL, limpiarFormatosCarrusel } from '@/lib/video/tipos'
import { ErrorIA } from '@/lib/ia/claude'
import * as asesor from '@/lib/ia/asesor'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { listaParaPiezas } from '@/lib/catalogo/lista-piezas'
import { leerFiltrosLista, parametrosLista, tipoDe, TOPE_POR_TIPO, type FiltrosLista } from '@/lib/catalogo/lista-piezas-reglas'
import { marcarProductos } from '@/app/seleccion-acciones'

const { carruseles, promos, promoFilas, seleccion, productos } = esquema

export type TipoNueva = 'nutriofertas' | 'lanzamiento' | 'receta' | 'promo' | 'destacado' | 'fecha'

/** Pieza nueva desde el asistente: el tipo, los formatos y los productos elegidos en el catálogo. */
export async function crearDesdeAsistente(tipo: TipoNueva, formatosIn: Record<string, boolean>): Promise<{ error: string } | void> {
  const config = await leerConfig()
  const elegidos = (await db.select({ id: seleccion.productoId }).from(seleccion).orderBy(asc(seleccion.agregadoEn))).map((e) => e.id)
  if (!elegidos.length && tipo !== 'promo') return { error: 'Elegí al menos un producto en el catálogo (o que la IA los elija).' }
  const hoy = hoyFormosa()
  const animacion = { ...ANIMACION_INICIAL, ...config.creacion.animacion }
  const f = formatosIn && typeof formatosIn === 'object' ? formatosIn : {}
  let destino: string
  if (tipo === 'promo') {
    const erp = await filasDelErp()
    const enErp = new Set(erp.flatMap((x) => x.productos.map((p) => p.id)))
    const filas: FilaEditor[] = [
      ...elegidos.filter((id) => !enErp.has(id)).map((id): FilaEditor => ({ tipo: 'producto', titulo: null, descuento: config.piezas.descuento, cantidadMinima: null, precioFijo: null, origen: 'manual', productos: [{ id }] })),
      ...erp.map((x): FilaEditor => ({ ...x, titulo: null, descuento: null, origen: 'erp' })),
    ]
    if (!filas.length) return { error: 'Elegí al menos un producto en el catálogo.' }
    const [{ id }] = await db.insert(promos).values({
      desde: hoy, hasta: sumarDias(hoy, config.piezas.vigenciaDias), diseno: await disenoSiguiente(), listaId: config.piezas.listaId, animacion,
      formatos: { historia: !!f.historia, feed: !!f.feed, uno: !!f.uno, reel: !!f.reel, historiaVideo: !!f.historiaVideo, videoFeed: !!f.videoFeed },
    }).returning({ id: promos.id })
    await db.insert(promoFilas).values(filas.map((x, orden) => ({ ...x, promoId: id, orden })))
    destino = `/promos/${id}`
  } else {
    const estilo: EstiloCarrusel = tipo === 'receta' ? 'recetas' : tipo === 'lanzamiento' || tipo === 'fecha' ? 'lanzamiento' : 'nutriofertas'
    const ids = tipo === 'destacado' ? elegidos.slice(0, 1) : elegidos
    const datos = datosIniciales(estilo, ids)
    let titulo = `${ESTILOS[estilo].nombre} ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}`
    if (tipo === 'destacado') titulo = `Destacado ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}`
    if (tipo === 'fecha') {
      const fecha = proximasFechas(hoy, 45)[0]
      if (fecha) {
        const d = datos as DatosLanzamiento
        const palabras = fecha.nombre.split(' ')
        const mitad = Math.ceil(palabras.length / 2)
        d.portada = { ...d.portada, kicker: '¡Se viene!', titulo: `${palabras.slice(0, mitad).join(' ')} / ${palabras.slice(mitad).join(' ')}`.replace(/ \/ $/, ''), pastilla: 'Pedí online' }
        titulo = fecha.nombre
      }
    }
    if (tipo === 'destacado') (datos as DatosNutriofertas).portada.titulo = 'Producto / destacado'
    const formatos: FormatosCarrusel = limpiarFormatosCarrusel(f)
    const [{ id }] = await db.insert(carruseles).values({ estilo, titulo: titulo.slice(0, 80), listaId: config.piezas.listaId, datos: datos as unknown as Record<string, unknown>, formatos, animacion }).returning({ id: carruseles.id })
    destino = `/carruseles/${id}`
  }
  await db.delete(seleccion)
  revalidatePath('/', 'layout')
  redirect(destino)
}

/** La IA elige productos para la pieza (sin repetir lo ya elegido) y los suma a la selección del catálogo. */
export async function elegirConIA(cuantos: number): Promise<{ ok: true; nombres: string[] } | { error: string }> {
  try {
    const s = await asesor.generarSugerencias()
    const ids = s.ideas.map((x) => x.id).slice(0, Math.min(6, Math.max(1, cuantos)))
    if (!ids.length) return { error: 'La IA no encontró productos para sugerir.' }
    await db.insert(seleccion).values(ids.map((productoId) => ({ productoId }))).onConflictDoNothing()
    revalidatePath('/', 'layout')
    const filas = await db.select({ nombre: productos.nombreSugerido }).from(productos).where(inArray(productos.id, ids))
    return { ok: true, nombres: filas.map((f) => f.nombre) }
  } catch (e) {
    if (e instanceof ErrorIA) return { error: e.message }
    console.error('[creacion ia]', e)
    return { error: 'Algo falló al pedirle productos a la IA.' }
  }
}

/** Saca un producto de la selección. */
export async function sacarElegido(id: number) {
  await db.delete(seleccion).where(eq(seleccion.productoId, Number(id)))
  revalidatePath('/', 'layout')
}

export async function elegidosConFoto() {
  return db.select({ id: productos.id, nombre: productos.nombreSugerido, foto: fotoEfectiva }).from(seleccion).innerJoin(productos, eq(productos.id, seleccion.productoId)).orderBy(asc(seleccion.agregadoEn))
}

// ---------------------------------------------------------------------------
// Lista de productos del paso «¿Qué productos?»
// ---------------------------------------------------------------------------
/** Una página de la lista con los filtros pedidos (se validan acá: pueden venir de la dirección de la página). */
export async function accionListaPiezas(f: FiltrosLista) {
  const config = await leerConfig()
  const limpio = leerFiltrosLista(Object.fromEntries(Object.entries(parametrosLista(f, 'nutriofertas')).filter(([k]) => k !== 'tipo')), 'nutriofertas')
  return listaParaPiezas(limpio, config.piezas.listaId)
}

/** Marcar o desmarcar un producto desde la lista, sin pasarse del tope del tipo de pieza. */
export async function accionMarcarParaPieza(id: number, marcar: boolean, tipo: string): Promise<{ ok: true } | { error: string }> {
  if (marcar) {
    const tope = TOPE_POR_TIPO[tipoDe(tipo)]
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(seleccion)
    if (tope != null && n >= tope) return { error: `Ya elegiste ${tope}: es lo que entra en esta pieza. Sacá uno para sumar otro.` }
  }
  await marcarProductos([Number(id)], marcar)
  return { ok: true }
}
