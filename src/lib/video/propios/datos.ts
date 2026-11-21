import 'server-only'
import { eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { precioNutri, productosPieza, type ProductoCarrusel } from '@/lib/carruseles/datos'
import { lineaChica, nombreEnPlaca, partirEnDos, renglones } from '@/lib/carruseles/textos'
import { textoPosteo } from '@/lib/carruseles/textos'
import { leerConfig } from '@/lib/configuracion'
import { qrDataUri } from '@/lib/piezas/qr'
import { huellaDe } from '@/lib/piezas/huella'
import { urlMedia } from '@/lib/media'
import { htmlVideo, type EscenaVideo } from '../escenas'
import { FORMATOS_VIDEO, type FormatoVideo } from '../tipos'
import { htmlCapas, type ProductoCapa } from './capas'
import { DUR_APERTURA, DUR_CIERRE, limpiarContenido, limpiarFormatosPropio, revisarPieza, tiempos, type VideoBiblioteca } from './reglas'

const { piezasVideo, videos, musica } = esquema

const lineas = (t: string) => renglones(t.includes('/') ? t : partirEnDos(t))

export type VideoCargado = typeof videos.$inferSelect

/** La pieza con su contenido limpio, los videos de la biblioteca que usa y los productos de las franjas. */
export async function cargarPiezaVideo(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null
  const [p] = await db.select().from(piezasVideo).where(eq(piezasVideo.id, id))
  if (!p) return null
  const ids = [...new Set((p.contenido?.clips ?? []).map((c) => Number(c.videoId)).filter(Number.isInteger))]
  const filas = ids.length ? await db.select().from(videos).where(inArray(videos.id, ids)) : []
  const deVideos = new Map(filas.map((v) => [v.id, v]))
  // Los clips de videos que todavía se preparan conservan sus segundos (se usa lo que dijo la pieza)
  const duraciones = Object.fromEntries(filas.map((v) => [v.id, v.duracion ?? 600]))
  const contenido = limpiarContenido(p.contenido, duraciones)
  const [prods, config] = await Promise.all([productosPieza(contenido.productos.map((x) => x.id)), leerConfig()])
  return { pieza: p, contenido, formatos: limpiarFormatosPropio(p.formatos), videos: deVideos, productos: prods, config }
}
export type PiezaVideoCargada = NonNullable<Awaited<ReturnType<typeof cargarPiezaVideo>>>

export const bibliotecaDe = (d: PiezaVideoCargada): Record<number, VideoBiblioteca> =>
  Object.fromEntries([...d.videos.values()].map((v) => [v.id, { id: v.id, nombre: v.nombre, estado: v.estado, duracion: v.duracion }]))

export function revisar(d: PiezaVideoCargada) {
  const nombres = Object.fromEntries([...d.productos.values()].map((p) => [p.id, p.nombre]))
  const sinPrecio = d.contenido.productos.filter((x) => !precioNutri(d.productos.get(x.id), x, d.contenido.listaId)).map((x) => x.id)
  const faltan = d.contenido.productos.filter((x) => !d.productos.get(x.id)).map((x) => x.id)
  const r = revisarPieza(d.contenido, d.formatos, bibliotecaDe(d), nombres, sinPrecio.filter((x) => !faltan.includes(x)))
  for (const x of faltan) r.bloquean.push(`El producto ${x} ya no está en el catálogo: sacalo.`)
  const bajas = [...d.productos.values()].filter((p) => p.dadoDeBaja).map((p) => p.nombre)
  if (bajas.length) r.avisos.push(`Dado de baja en el ERP: ${bajas.join(', ')}.`)
  return r
}

/** Lo que dice la franja de cada producto (nombre, línea chica, precio de la lista menos el descuento, sello). */
export function productosCapa(d: PiezaVideoCargada): ProductoCapa[] {
  return d.contenido.productos.flatMap((x) => {
    const p: ProductoCarrusel | undefined = d.productos.get(x.id)
    if (!p) return []
    const precio = precioNutri(p, x, d.contenido.listaId)
    return [{
      id: x.id, nombre: lineas(nombreEnPlaca(p)), linea: lineaChica(p), foto: p.foto,
      precio: precio ? { texto: precio.texto, unidad: precio.unidad, antes: precio.antes } : null,
      sello: x.sello ? (precio?.antes && x.descuento > 0 ? `-${x.descuento}%` : 'Oferta') : null,
      desde: x.desde, hasta: x.hasta,
    }]
  })
}

const opcionesCapas = (d: PiezaVideoCargada, formato: FormatoVideo, vista: boolean) => ({
  tema: d.contenido.estilo, ancho: FORMATOS_VIDEO[formato].ancho, alto: FORMATOS_VIDEO[formato].alto, web: d.config.contacto.web,
  productos: productosCapa(d), textos: d.contenido.textos.filter((t) => t.texto.trim()), medio: tiempos(d.contenido).medio, vista,
})

/** Qué capas hay y cuándo se ven (para animarlas con ffmpeg). */
export const capasDeclaradas = (d: PiezaVideoCargada, formato: FormatoVideo = 'reel') => htmlCapas(opcionesCapas(d, formato, false)).capas

export type ParteVideo = 'apertura' | 'cierre' | 'capas'

/** El HTML de una parte del video en un formato: la apertura y el cierre animados, o las capas de encima. */
export function htmlParte(d: PiezaVideoCargada, formato: FormatoVideo, parte: ParteVideo, vista: boolean): string {
  const fv = FORMATOS_VIDEO[formato]
  const c = d.contenido
  if (parte === 'capas') return htmlCapas(opcionesCapas(d, formato, vista)).html
  const primera = c.productos.map((x) => d.productos.get(x.id)?.foto).find(Boolean) ?? null
  const escena: EscenaVideo = parte === 'apertura'
    ? { tipo: 'portada', kicker: c.apertura.kicker || null, titulo: lineas(c.apertura.titulo || ' '), fotos: primera ? [primera] : [], sub: null, sello: null }
    : { tipo: 'cierre', titulo: renglones(c.cierre.titulo), bajada: c.cierre.bajada || null }
  return htmlVideo({
    tema: c.estilo, escenas: [escena], ancho: fv.ancho, alto: fv.alto, maximo: parte === 'apertura' ? DUR_APERTURA : DUR_CIERRE,
    ritmo: 'suave', variante: '1', semilla: d.pieza.id * 7919, contacto: d.config.contacto, qr: qrDataUri(`https://${d.config.contacto.web}`), vista: false,
  }).html
}

/** Huella del video en un formato: si cambia algo (clips, textos, precios, fotos, música, contacto), hay que armarlo de nuevo. */
export async function huellaVideo(d: PiezaVideoCargada, formato: FormatoVideo): Promise<string> {
  const c = d.contenido
  const fv = FORMATOS_VIDEO[formato]
  const [tema] = c.sonido.musicaId && c.sonido.modo !== 'original' ? await db.select({ archivo: musica.archivo }).from(musica).where(eq(musica.id, c.sonido.musicaId)) : []
  return huellaDe([
    `${fv.ancho}x${fv.alto}`,
    JSON.stringify({ clips: c.clips, encuadre: c.encuadre, modo: c.sonido.modo, portada: c.portada }),
    c.clips.map((x) => d.videos.get(x.videoId)?.archivo ?? '').join('|'),
    tema?.archivo ?? '',
    c.apertura.activa ? htmlParte(d, formato, 'apertura', false) : '',
    c.cierre.activa ? htmlParte(d, formato, 'cierre', false) : '',
    htmlParte(d, formato, 'capas', false),
  ])
}

/** Texto del posteo automático: el título de la apertura y los productos de las franjas. */
export function posteoVideo(d: PiezaVideoCargada): string {
  const nombres = d.contenido.productos.map((x) => d.productos.get(x.id)?.nombre).filter((x): x is string => !!x)
  const titulo = (d.contenido.apertura.titulo || d.pieza.titulo).replace(/\s*\/\s*/g, ' ')
  return textoPosteo('lanzamiento', { titulo, productos: nombres, contacto: d.config.contacto, hashtags: d.config.ia.hashtags })
}

/** Videos listos de la biblioteca (para sumar clips en el editor). */
export async function bibliotecaLista() {
  const filas = await db.select().from(videos).where(eq(videos.estado, 'listo')).orderBy(sql`${videos.creadoEn} desc`).limit(200)
  return filas.map((v) => ({ id: v.id, nombre: v.nombre, duracion: v.duracion ?? 0, ancho: v.ancho ?? 1080, alto: v.alto ?? 1920, archivo: v.archivo ? urlMedia(v.archivo) : null, miniatura: v.miniatura ? urlMedia(v.miniatura) : null, conAudio: v.conAudio }))
}
export type VideoDeBiblioteca = Awaited<ReturnType<typeof bibliotecaLista>>[number]
