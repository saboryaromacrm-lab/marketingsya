import 'server-only'
import { randomBytes } from 'node:crypto'
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cola, COLA_RENDER } from '@/lib/cola'
import { borrarMedia, rutaSegura, urlMedia } from '@/lib/media'
import { correrFfmpeg, cuadroJpeg, puedeCorregirTono, sondearVideo } from '@/lib/render/video-propio'
import { argumentosComprimir, DIAS_LIMPIEZA, esExtensionVideo, fechaBorrado, MAX_DURACION_SUBIDA, MAX_SUBIDA, PEDAZO, porBorrarse } from './reglas'

// «Mis videos»: la biblioteca de videos de Lucas. Se suben en pedazos (así un video pesado no se corta),
// se comprimen a 1080p en la cola (uno por vez) y se borra el original para no llenar el disco del servidor.

const { videos, piezasVideo } = esquema

const nombreLimpio = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Video'

/** Empieza una subida: devuelve el id y el tamaño de cada pedazo. */
export async function crearSubida(o: { nombre: string; tamano: number }): Promise<{ id: number; pedazo: number } | { error: string }> {
  if (!esExtensionVideo(o.nombre)) return { error: 'El video tiene que ser MP4, MOV o WEBM.' }
  if (!Number.isFinite(o.tamano) || o.tamano <= 0) return { error: 'El archivo está vacío.' }
  if (o.tamano > MAX_SUBIDA) return { error: `El video pesa ${Math.round(o.tamano / 1048576)} MB: el máximo es ${MAX_SUBIDA / 1048576} MB. Recortalo en el celular o mandalo en menor calidad.` }
  const [v] = await db.insert(videos).values({ nombre: nombreLimpio(o.nombre), tamano: Math.round(o.tamano), estado: 'subiendo' }).returning({ id: videos.id })
  // A medias va fuera de lo que sirve /media (la extensión .part no se sirve)
  const temporal = `tmp/subidas/${v.id}-${randomBytes(6).toString('hex')}.part`
  const ruta = rutaSegura(temporal)!
  await mkdir(path.dirname(ruta), { recursive: true })
  await (await open(ruta, 'w')).close()
  await db.update(videos).set({ temporal }).where(eq(videos.id, v.id))
  return { id: v.id, pedazo: PEDAZO }
}

/** Suma un pedazo. «desde» tiene que ser lo que ya llegó (si se repite un pedazo, no se duplica). */
export async function recibirPedazo(id: number, desde: number, datos: Uint8Array): Promise<{ recibido: number } | { error: string; recibido?: number }> {
  const [v] = await db.select().from(videos).where(eq(videos.id, id))
  if (!v || v.estado !== 'subiendo' || !v.temporal) return { error: 'Esa subida ya no está abierta.' }
  const ruta = rutaSegura(v.temporal)
  if (!ruta) return { error: 'Ruta inválida.' }
  const actual = (await stat(ruta).catch(() => null))?.size ?? 0
  if (desde !== actual) return { error: 'Se desordenó la subida.', recibido: actual }
  if (datos.length > PEDAZO) return { error: 'El pedazo es demasiado grande.' }
  if (actual + datos.length > v.tamano) return { error: 'Llegó más de lo anunciado.' }
  const f = await open(ruta, 'a')
  try { await f.write(datos) } finally { await f.close() }
  const recibido = actual + datos.length
  await db.update(videos).set({ recibido }).where(eq(videos.id, id))
  return { recibido }
}

/** Llegó todo: se pone en la cola para comprimirlo. */
export async function terminarSubida(id: number): Promise<{ ok: true } | { error: string }> {
  const [v] = await db.select().from(videos).where(eq(videos.id, id))
  if (!v || v.estado !== 'subiendo') return { error: 'Esa subida ya no está abierta.' }
  if (v.recibido !== v.tamano) return { error: `Faltan ${Math.round((v.tamano - v.recibido) / 1048576)} MB por subir.` }
  await db.update(videos).set({ estado: 'procesando', avance: 0 }).where(eq(videos.id, id))
  try {
    await (await cola()).send(COLA_RENDER, { video: id })
  } catch {
    await db.update(videos).set({ estado: 'error', error: 'No se pudo poner en la cola de tareas.' }).where(eq(videos.id, id))
    return { error: 'No se pudo poner en la cola de tareas.' }
  }
  return { ok: true }
}

/** Lo hace la cola: revisa el video, lo comprime a 1080p, saca la miniatura y borra el original. */
export async function procesarVideo(id: number) {
  const [v] = await db.select().from(videos).where(eq(videos.id, id))
  if (!v || v.estado !== 'procesando' || !v.temporal) return
  const original = rutaSegura(v.temporal)
  const fallar = async (error: string) => {
    await db.update(videos).set({ estado: 'error', error, temporal: null }).where(eq(videos.id, id))
    if (original) await rm(original, { force: true })
  }
  if (!original) return fallar('Ruta inválida.')
  try {
    const info = await sondearVideo(original)
    if (!info) return fallar('No se pudo leer ese video. Probá con un MP4 o un MOV del celular.')
    if (info.duracion > MAX_DURACION_SUBIDA + 0.5) return fallar(`El video dura ${Math.round(info.duracion)} s: el máximo es ${MAX_DURACION_SUBIDA / 60} minutos. Recortalo antes de subirlo.`)
    if (info.duracion < 1) return fallar('El video dura menos de 1 segundo.')
    const base = `videos/${id}-${randomBytes(6).toString('hex')}`
    const archivo = `${base}.mp4`, miniatura = `${base}.jpg`
    const destino = rutaSegura(archivo)!, temporal = `${destino}.${process.pid}.tmp.mp4`
    await mkdir(path.dirname(destino), { recursive: true })
    const args = argumentosComprimir({ entrada: original, salida: temporal, ancho: info.ancho, alto: info.alto, hdr: info.hdr, conAudio: info.conAudio, tonemap: await puedeCorregirTono() })
    let ultimo = 0
    await correrFfmpeg(args, info.duracion, (pct) => {
      const avance = Math.round(pct * 95)
      if (avance >= ultimo + 5) { ultimo = avance; void db.update(videos).set({ avance }).where(eq(videos.id, id)) }
    })
    const final = await sondearVideo(temporal)
    if (!final) { await rm(temporal, { force: true }); return fallar('No se pudo preparar la copia del video.') }
    await rename(temporal, destino)
    await cuadroJpeg(destino, Math.min(1, final.duracion / 2), rutaSegura(miniatura)!, 480)
    await db.update(videos).set({
      estado: 'listo', avance: 100, archivo, miniatura, temporal: null, error: null,
      duracion: Math.round(final.duracion * 100) / 100, ancho: final.ancho, alto: final.alto, conAudio: final.conAudio,
    }).where(eq(videos.id, id))
    await rm(original, { force: true })
  } catch (e) {
    console.error(`[video ${id}]`, e)
    await fallar(e instanceof Error ? e.message.split('\n')[0] : 'No se pudo preparar el video.')
  }
}

/** En cuántas piezas está cada video. */
async function usos(): Promise<Map<number, number>> {
  const filas = await db.execute<{ video_id: number; n: number }>(sql`
    select (c->>'videoId')::int as video_id, count(distinct p.id)::int as n
    from ${piezasVideo} p, jsonb_array_elements(p.contenido->'clips') c
    group by 1`)
  return new Map(filas.rows.map((r) => [Number(r.video_id), Number(r.n)]))
}

export type VideoListado = {
  id: number; nombre: string; estado: string; avance: number; error: string | null
  duracion: number | null; ancho: number | null; alto: number | null; tamano: number; recibido: number
  video: string | null; miniatura: string | null; productos: { id: number; nombre: string; foto: string | null }[]
  piezas: number; conservar: boolean; creadoEn: string; borrado: string | null; avisar: boolean
}

export async function listarBiblioteca(): Promise<VideoListado[]> {
  const [filas, enUso] = await Promise.all([db.select().from(videos).orderBy(desc(videos.creadoEn)).limit(300), usos()])
  const ids = [...new Set(filas.flatMap((v) => v.productos))]
  const { productosPieza } = await import('@/lib/carruseles/datos')
  const prods = await productosPieza(ids)
  return filas.map((v) => {
    const piezas = enUso.get(v.id) ?? 0
    const borrado = v.estado === 'listo' ? fechaBorrado(v, piezas > 0) : null
    return {
      id: v.id, nombre: v.nombre, estado: v.estado, avance: v.avance, error: v.error,
      duracion: v.duracion, ancho: v.ancho, alto: v.alto, tamano: v.tamano, recibido: v.recibido,
      video: v.archivo ? urlMedia(v.archivo) : null, miniatura: v.miniatura ? urlMedia(v.miniatura) : null,
      productos: v.productos.map((p) => prods.get(p)).filter((p) => !!p).map((p) => ({ id: p.id, nombre: p.nombre, foto: p.foto })),
      piezas, conservar: v.conservar, creadoEn: v.creadoEn.toISOString(), borrado: borrado?.toISOString() ?? null, avisar: porBorrarse(borrado),
    }
  })
}

export async function cambiarVideo(id: number, cambios: { nombre?: string; productos?: number[]; conservar?: boolean }) {
  const set: Partial<typeof videos.$inferInsert> = {}
  if (typeof cambios.nombre === 'string') set.nombre = cambios.nombre.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Video'
  if (Array.isArray(cambios.productos)) set.productos = [...new Set(cambios.productos.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 12)
  if (typeof cambios.conservar === 'boolean') set.conservar = cambios.conservar
  if (Object.keys(set).length) await db.update(videos).set(set).where(eq(videos.id, id))
}

/** Borra un video de la biblioteca (si no está en ninguna pieza). */
export async function borrarVideo(id: number): Promise<{ ok: true } | { error: string }> {
  const n = (await usos()).get(id) ?? 0
  if (n) return { error: `Está en ${n} ${n === 1 ? 'pieza' : 'piezas'}: sacalo de ahí primero.` }
  const [v] = await db.delete(videos).where(eq(videos.id, id)).returning()
  if (v) for (const a of [v.archivo, v.miniatura, v.temporal]) await borrarMedia(a)
  return { ok: true }
}

/** Marca como usados los videos de una pieza (la limpieza cuenta los 90 días desde acá). */
export async function marcarUsados(ids: number[]) {
  if (ids.length) await db.update(videos).set({ usadoEn: new Date() }).where(inArray(videos.id, ids))
}

/**
 * Limpieza (cada hora): borra los videos que no están en ninguna pieza ni marcados «Conservar» a los 90 días,
 * y las subidas que quedaron a medias hace más de un día.
 */
export async function limpiarBiblioteca() {
  const enUso = await usos()
  const limite = new Date(Date.now() - DIAS_LIMPIEZA * 864e5)
  const viejos = await db.select().from(videos).where(and(eq(videos.estado, 'listo'), eq(videos.conservar, false), lt(videos.creadoEn, limite), or(sql`${videos.usadoEn} is null`, lt(videos.usadoEn, limite))))
  const colgados = await db.select().from(videos).where(and(inArray(videos.estado, ['subiendo', 'error']), lt(videos.creadoEn, new Date(Date.now() - 864e5))))
  let n = 0
  for (const v of [...viejos.filter((x) => !enUso.get(x.id)), ...colgados]) {
    await db.delete(videos).where(eq(videos.id, v.id))
    for (const a of [v.archivo, v.miniatura, v.temporal]) await borrarMedia(a)
    n++
  }
  if (n) console.log(`[videos] limpieza: se borraron ${n}`)
  await limpiarRestos()
}

/** Restos de más de un día: subidas a medias sin fila y carpetas de armado que quedaron por un reinicio. */
async function limpiarRestos() {
  const vivos = new Set((await db.select({ t: videos.temporal }).from(videos)).map((v) => v.t).filter(Boolean))
  const viejo = Date.now() - 864e5
  for (const carpeta of ['tmp/subidas', 'tmp']) {
    const ruta = rutaSegura(carpeta)
    if (!ruta) continue
    for (const nombre of await readdir(ruta).catch(() => [] as string[])) {
      const relativa = `${carpeta}/${nombre}`
      if (carpeta === 'tmp' && !nombre.startsWith('armar-')) continue
      if (vivos.has(relativa)) continue
      const info = await stat(path.join(ruta, nombre)).catch(() => null)
      if (info && info.mtimeMs < viejo) await rm(path.join(ruta, nombre), { recursive: true, force: true })
    }
  }
}

/** Al arrancar: lo que se estaba comprimiendo quedó cortado; se vuelve a poner en la cola. */
export async function recuperarVideos() {
  const pendientes = await db.select({ id: videos.id }).from(videos).where(eq(videos.estado, 'procesando'))
  for (const v of pendientes) await (await cola()).send(COLA_RENDER, { video: v.id }).catch(() => {})
}
