import 'server-only'
import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { encolarExportacion } from '@/lib/piezas/exportar'
import { rutaSegura, urlMedia } from '@/lib/media'
import { firmaDeRuta, rutaCanonica } from '@/lib/render/firma'
import { grabarVideo } from '@/lib/render/video'
import { capturarCapas, correrFfmpeg, cuadroJpeg } from '@/lib/render/video-propio'
import { FORMATOS_VIDEO, esFormatoVideo, type FormatoVideo } from '../tipos'
import type { EstadoVideo } from '../exportar'
import { capasDeclaradas, cargarPiezaVideo, huellaVideo, revisar, type PiezaVideoCargada } from './datos'
import { argumentosFfmpeg, formatosElegidos, tiempos, DUR_APERTURA, DUR_CIERRE } from './reglas'
import { marcarUsados } from './biblioteca'

const { exportaciones, musica } = esquema

export const rutaParte = (id: number, formato: FormatoVideo, parte: 'apertura' | 'cierre' | 'capas', vista = false) =>
  `/render/video/propio/${id}?formato=${formato}&parte=${parte}${vista ? '&vista=1' : ''}`

async function ultima(id: number, formato: FormatoVideo) {
  const [x] = await db.select().from(exportaciones).where(and(eq(exportaciones.tipo, 'video'), eq(exportaciones.referenciaId, id), eq(exportaciones.formato, formato))).orderBy(desc(exportaciones.id)).limit(1)
  return x ?? null
}

const resumen = (x: typeof exportaciones.$inferSelect | null) =>
  x ? { id: x.id, estado: x.estado, avance: x.avance, video: x.archivos[0] ? urlMedia(x.archivos[0]) : null, portada: x.archivos[1] ? urlMedia(x.archivos[1]) : null, error: x.error } : null

/** Cada formato marcado: su último armado y si sigue al día con la pieza. */
export async function estadoVideosPropio(id: number, d?: PiezaVideoCargada | null): Promise<EstadoVideo[]> {
  const pieza = d ?? (await cargarPiezaVideo(id))
  if (!pieza) return []
  const t = tiempos(pieza.contenido)
  const r: EstadoVideo[] = []
  for (const formato of formatosElegidos(pieza.formatos)) {
    const [huella, x] = await Promise.all([huellaVideo(pieza, formato), ultima(id, formato)])
    r.push({ formato, nombre: FORMATOS_VIDEO[formato].nombre, total: t.total, omitidas: 0, alDia: !!x && x.estado === 'ok' && x.huella === huella, exportacion: resumen(x) })
  }
  return r
}

/** Arma los formatos que no están al día (o el que se pida). El reel y la historia en video comparten medida: si uno está al día, el otro se copia. */
export async function armarVideosPropio(id: number, solo?: FormatoVideo): Promise<{ ok: true; exportaciones: { formato: FormatoVideo; id: number }[] } | { error: string }> {
  const d = await cargarPiezaVideo(id)
  if (!d) return { error: 'Ese video ya no existe.' }
  const rev = revisar(d)
  if (rev.bloquean.length) return { error: rev.bloquean[0] }
  const formatos = formatosElegidos(d.formatos).filter((f) => !solo || f === solo)
  if (!formatos.length) return { error: 'Marcá dónde sale (reel, historia en video o video de feed).' }
  const hechos: { formato: FormatoVideo; id: number }[] = []
  const porHuella = new Map<string, typeof exportaciones.$inferSelect>()
  for (const formato of formatos) {
    const [huella, x] = await Promise.all([huellaVideo(d, formato), ultima(id, formato)])
    if (x && (x.estado === 'en_cola' || x.estado === 'corriendo' || (x.estado === 'ok' && x.huella === huella))) { hechos.push({ formato, id: x.id }); porHuella.set(huella, x); continue }
    // ¿Otro formato con la misma huella ya armado? Se copia el archivo (el reel y la historia en video son iguales)
    const otro = porHuella.get(huella) ?? (await Promise.all((Object.keys(FORMATOS_VIDEO) as FormatoVideo[]).filter((f) => f !== formato).map((f) => ultima(id, f)))).find((y) => y?.estado === 'ok' && y.huella === huella) ?? null
    if (otro && otro.estado === 'ok' && otro.archivos.length === 2) {
      const carpeta = `piezas/v${id}-${formato}-${Date.now()}`
      const archivos = [`${carpeta}/${formato}.mp4`, `${carpeta}/${formato}-portada.jpg`]
      await mkdir(path.dirname(rutaSegura(archivos[0])!), { recursive: true })
      await copyFile(rutaSegura(otro.archivos[0])!, rutaSegura(archivos[0])!)
      await copyFile(rutaSegura(otro.archivos[1])!, rutaSegura(archivos[1])!)
      const [n] = await db.insert(exportaciones).values({ tipo: 'video', referenciaId: id, placas: otro.placas, estado: 'ok', avance: 100, archivos, zip: archivos[0], huella, formato, terminadoEn: new Date() }).returning({ id: exportaciones.id })
      hechos.push({ formato, id: n.id })
      continue
    }
    const expId = await encolarExportacion('video', [`/render/video/propio/${id}?formato=${formato}`], id, huella, formato)
    hechos.push({ formato, id: expId })
  }
  return { ok: true, exportaciones: hechos }
}

/** La exportación al día de un formato (o la arma). Para publicar. */
export async function videoPropioAlDia(id: number, formato: FormatoVideo): Promise<number | null> {
  const r = await armarVideosPropio(id, formato)
  return 'error' in r ? null : r.exportaciones.find((x) => x.formato === formato)?.id ?? null
}

// Chromium abre la apertura, el cierre y las capas pidiéndoselas al propio servidor
const base = () => `http://127.0.0.1:${process.env.PORT || 3000}`
const firmada = (ruta: string) => {
  const u = new URL(ruta, base())
  u.searchParams.set('firma', firmaDeRuta(rutaCanonica(u.pathname, u.searchParams), process.env.SESION_SECRETO ?? '', 1800))
  return u.toString()
}

/** Lo hace la cola: graba la apertura y el cierre, saca las capas y ffmpeg une todo con los clips. */
export async function ejecutarVideoPropio(exp: typeof exportaciones.$inferSelect) {
  const id = exp.referenciaId!
  const formato = exp.formato
  if (!esFormatoVideo(formato)) throw new Error('Formato de video desconocido.')
  const d = await cargarPiezaVideo(id)
  if (!d) throw new Error('Ese video ya no existe.')
  const rev = revisar(d)
  if (rev.bloquean.length) throw new Error(rev.bloquean[0])
  const fv = FORMATOS_VIDEO[formato]
  const c = d.contenido
  const avance = (n: number) => void db.update(exportaciones).set({ avance: Math.round(n) }).where(eq(exportaciones.id, exp.id))
  const carpeta = `piezas/${exp.id}`
  const video = `${carpeta}/${formato}.mp4`, portada = `${carpeta}/${formato}-portada.jpg`
  const destino = rutaSegura(video), destinoPortada = rutaSegura(portada), tmp = rutaSegura(`tmp/armar-${exp.id}`)
  if (!destino || !destinoPortada || !tmp) throw new Error('ruta inválida')
  await mkdir(tmp, { recursive: true })
  await mkdir(path.dirname(destino), { recursive: true })
  try {
    // 1. Apertura y cierre: las escenas animadas de los reels
    let apertura: { archivo: string; duracion: number } | null = null
    let cierre: { archivo: string; duracion: number } | null = null
    if (c.apertura.activa) {
      const r = await grabarVideo(firmada(rutaParte(id, formato, 'apertura')), { salida: path.join(tmp, 'apertura.mp4'), portada: path.join(tmp, 'ap.jpg'), segundoPortada: 0, musica: null, alAvanzar: (p) => avance(5 + p * 12) })
      apertura = { archivo: path.join(tmp, 'apertura.mp4'), duracion: r.duracion || DUR_APERTURA }
    }
    if (c.cierre.activa) {
      const r = await grabarVideo(firmada(rutaParte(id, formato, 'cierre')), { salida: path.join(tmp, 'cierre.mp4'), portada: path.join(tmp, 'ci.jpg'), segundoPortada: 0, musica: null, alAvanzar: (p) => avance(17 + p * 12) })
      cierre = { archivo: path.join(tmp, 'cierre.mp4'), duracion: r.duracion || DUR_CIERRE }
    }
    // 2. Las capas (logo, tienda, franjas, sellos, textos) como PNG transparentes
    const fotos = await capturarCapas(firmada(rutaParte(id, formato, 'capas')), tmp)
    const plan = capasDeclaradas(d, formato)
    const capas = fotos.flatMap((f) => {
      const p = plan.find((x) => x.id === f.id)
      return p ? [{ archivo: f.archivo, x: f.x, y: f.y, desde: p.desde, hasta: p.hasta, animacion: p.animacion }] : []
    })
    avance(32)
    // 3. ffmpeg une todo
    const [tema] = c.sonido.musicaId && c.sonido.modo !== 'original' ? await db.select({ archivo: musica.archivo }).from(musica).where(eq(musica.id, c.sonido.musicaId)) : []
    const temporal = path.join(tmp, 'final.mp4')
    const { args, total } = argumentosFfmpeg({
      ancho: fv.ancho, alto: fv.alto, encuadre: c.encuadre,
      clips: c.clips.map((x) => {
        const v = d.videos.get(x.videoId)!
        return { archivo: rutaSegura(v.archivo!)!, desde: x.desde, duracion: Math.round((x.hasta - x.desde) * 100) / 100, conAudio: v.conAudio, ancho: v.ancho ?? 1080, alto: v.alto ?? 1920 }
      }),
      apertura, cierre, capas, sonido: c.sonido.modo, musica: tema ? rutaSegura(tema.archivo) : null, salida: temporal,
    })
    await correrFfmpeg(args, total, (p) => avance(32 + p * 64))
    await cuadroJpeg(temporal, Math.min(c.portada, Math.max(0, total - 0.1)), path.join(tmp, 'portada.jpg'))
    await rename(temporal, destino)
    await rename(path.join(tmp, 'portada.jpg'), destinoPortada)
    await db.update(exportaciones).set({ estado: 'ok', avance: 100, archivos: [video, portada], zip: video, terminadoEn: new Date() }).where(eq(exportaciones.id, exp.id))
    await marcarUsados(c.clips.map((x) => x.videoId))
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
