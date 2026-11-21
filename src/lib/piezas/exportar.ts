import 'server-only'
import { eq, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cola, COLA_RENDER } from '@/lib/cola'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { borrarMedia, guardarMedia, rutaSegura } from '@/lib/media'
import { grabarVideo } from '@/lib/render/video'
import { renderizarJpeg } from '@/lib/render/navegador'
import { firmaDeRuta, rutaCanonica } from '@/lib/render/firma'
import { armarZip } from '@/lib/render/zip'

const { exportaciones } = esquema

// Chromium abre las placas pidiéndoselas al propio servidor
const base = () => `http://127.0.0.1:${process.env.PORT || 3000}`

/** Crea la exportación y la pone en la cola. Devuelve su id. */
export async function encolarExportacion(tipo: 'prueba' | 'carrusel' | 'promo', placas: string[], referenciaId: number | null = null, huella: string | null = null, formato: string | null = null) {
  const [{ id }] = await db.insert(exportaciones).values({ tipo, referenciaId, placas, estado: 'en_cola', huella, formato }).returning({ id: exportaciones.id })
  try {
    await (await cola()).send(COLA_RENDER, { id })
  } catch (e) {
    await db.update(exportaciones).set({ estado: 'error', error: 'No se pudo poner en la cola de tareas.' }).where(eq(exportaciones.id, id))
    throw e
  }
  return id
}

export async function ejecutarExportacion(id: number) {
  const [exp] = await db.select().from(exportaciones).where(eq(exportaciones.id, id))
  if (!exp) return
  try {
    await db.update(exportaciones).set({ estado: 'corriendo', avance: 5 }).where(eq(exportaciones.id, id))
    const secreto = process.env.SESION_SECRETO ?? ''
    if (exp.formato) {
      await ejecutarVideo(exp, secreto)
      return
    }
    const urls = exp.placas.map((ruta) => {
      const u = new URL(ruta, base())
      // La firma cubre la ruta y sus parámetros: no se puede reusar cambiando, por ejemplo, los productos
      u.searchParams.set('firma', firmaDeRuta(rutaCanonica(u.pathname, u.searchParams), secreto))
      return u.toString()
    })
    const jpegs = await renderizarJpeg(urls, {
      alAvanzar: (n) => void db.update(exportaciones).set({ avance: 5 + Math.round((n / urls.length) * 85) }).where(eq(exportaciones.id, id)),
    })
    const carpeta = `piezas/${id}`
    // «historia-1.jpg», «feed-2.jpg»… si la placa dice su formato; si no, «placa-3.jpg»
    const nombres = exp.placas.map((ruta, i) => {
      const q = new URL(ruta, base()).searchParams
      const f = q.get('formato')?.replace(/[^a-z]/g, '')
      return f ? `${f}-${q.get('pagina')?.replace(/\D/g, '') || i + 1}.jpg` : `placa-${i + 1}.jpg`
    })
    for (let i = 0; i < jpegs.length; i++) await guardarMedia(`${carpeta}/${nombres[i]}`, jpegs[i])
    const zip = `${carpeta}/${exp.tipo}-${id}.zip`
    await guardarMedia(zip, armarZip(jpegs.map((datos, i) => ({ nombre: nombres[i], datos }))))
    await db
      .update(exportaciones)
      .set({ estado: 'ok', avance: 100, archivos: nombres.map((n) => `${carpeta}/${n}`), zip, terminadoEn: new Date() })
      .where(eq(exportaciones.id, id))
  } catch (e) {
    console.error(`[exportacion ${id}]`, e)
    const mensaje = e instanceof Error ? e.message.split('\n')[0] : String(e)
    await db.update(exportaciones).set({ estado: 'error', error: mensaje, terminadoEn: new Date() }).where(eq(exportaciones.id, id))
  }
}

/** Un video: se graba cuadro por cuadro y queda el MP4 y su portada (el .zip para descargar es el mismo MP4). */
async function ejecutarVideo(exp: typeof exportaciones.$inferSelect, secreto: string) {
  const u = new URL(exp.placas[0], base())
  u.searchParams.set('firma', firmaDeRuta(rutaCanonica(u.pathname, u.searchParams), secreto, 1800))
  const musicaId = Number(u.searchParams.get('musica')) || null
  const [tema] = musicaId ? await db.select({ archivo: esquema.musica.archivo }).from(esquema.musica).where(eq(esquema.musica.id, musicaId)) : []
  const carpeta = `piezas/${exp.id}`
  const video = `${carpeta}/${exp.formato}.mp4`, portada = `${carpeta}/${exp.formato}-portada.jpg`
  const destino = rutaSegura(video), destinoPortada = rutaSegura(portada)
  if (!destino || !destinoPortada) throw new Error('ruta inválida')
  await mkdir(path.dirname(destino), { recursive: true })
  await grabarVideo(u.toString(), {
    salida: destino,
    portada: destinoPortada,
    segundoPortada: Number(u.searchParams.get('portada') ?? 0.8),
    musica: tema ? rutaSegura(tema.archivo) : null,
    alAvanzar: (pct) => void db.update(exportaciones).set({ avance: 5 + Math.round(pct * 90) }).where(eq(exportaciones.id, exp.id)),
  })
  await db.update(exportaciones).set({ estado: 'ok', avance: 100, archivos: [video, portada], zip: video, terminadoEn: new Date() }).where(eq(exportaciones.id, exp.id))
}

/** Borra exportaciones viejas de un tipo (archivos y filas), dejando las últimas `dejar`. */
export async function limpiarExportaciones(tipo: string, dejar: number) {
  const filas = await db.select({ id: exportaciones.id, archivos: exportaciones.archivos, zip: exportaciones.zip }).from(exportaciones).where(eq(exportaciones.tipo, tipo))
  const viejas = filas.sort((a, b) => b.id - a.id).slice(dejar)
  for (const v of viejas) for (const a of [...v.archivos, v.zip]) await borrarMedia(a)
  if (viejas.length) await db.delete(exportaciones).where(inArray(exportaciones.id, viejas.map((v) => v.id)))
}
