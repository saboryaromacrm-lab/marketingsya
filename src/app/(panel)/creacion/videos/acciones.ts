'use server'

import { borrarPieza } from '@/lib/creacion/borrar'
import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import type { ContenidoVideo, FormatosVideoPropio } from '@/lib/db/esquema'
import { borrarVideo, cambiarVideo, listarBiblioteca } from '@/lib/video/propios/biblioteca'
import { cargarPiezaVideo, posteoVideo, productosCapa, revisar } from '@/lib/video/propios/datos'
import { contenidoInicial, FORMATOS_PROPIO_INICIAL, limpiarContenido, limpiarFormatosPropio, tiempos } from '@/lib/video/propios/reglas'

const { videos, piezasVideo, listas } = esquema

/** Nombre y foto de productos (para las etiquetas de los videos y las franjas). */
export async function accionInfoProductos(ids: number[]) {
  const { productosPieza } = await import('@/lib/carruseles/datos')
  const m = await productosPieza((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 20))
  return [...m.values()].map((p) => ({ id: p.id, nombre: p.nombre, foto: p.foto }))
}

export async function accionListarVideos() {
  return listarBiblioteca()
}

export async function accionCambiarVideo(id: number, cambios: { nombre?: string; productos?: number[]; conservar?: boolean }) {
  await cambiarVideo(Number(id), cambios ?? {})
  revalidatePath('/creacion/videos')
  return { ok: true as const }
}

export async function accionBorrarVideo(id: number) {
  const r = await borrarVideo(Number(id))
  revalidatePath('/creacion/videos')
  return r
}

/** Arma una pieza nueva con uno o varios videos de la biblioteca (y sus productos, como franjas). */
export async function accionNuevaPiezaVideo(ids: number[]): Promise<{ id: number } | { error: string }> {
  const pedidos = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 5)
  if (!pedidos.length) return { error: 'Elegí un video.' }
  const filas = await db.select().from(videos).where(inArray(videos.id, pedidos))
  const listos = pedidos.map((id) => filas.find((v) => v.id === id)).filter((v) => v && v.estado === 'listo' && v.duracion)
  if (!listos.length) return { error: 'Ese video todavía se está preparando.' }
  // De entrada, hasta 30 s de cada clip: después se recorta en el editor
  const clips = listos.map((v) => ({ videoId: v!.id, desde: 0, hasta: Math.min(v!.duracion!, 30) }))
  const productos = [...new Set(listos.flatMap((v) => v!.productos))]
  const contenido = contenidoInicial({ clips, productos, titulo: '¡Mirá lo nuevo!' })
  const [p] = await db.insert(piezasVideo).values({ titulo: listos[0]!.nombre, contenido, formatos: FORMATOS_PROPIO_INICIAL }).returning({ id: piezasVideo.id })
  revalidatePath('/creacion/piezas')
  return { id: p.id }
}

export type GuardarPiezaVideo = { titulo: string; contenido: ContenidoVideo; formatos: FormatosVideoPropio; textoPosteo: string | null }

/** Guarda la pieza y devuelve lo que la pantalla necesita para mostrarla al día (revisión, tiempos y franjas). */
export async function accionGuardarPiezaVideo(id: number, g: GuardarPiezaVideo) {
  const actual = await cargarPiezaVideo(Number(id))
  if (!actual) return { error: 'Ese video ya no existe.' }
  const ids = [...new Set((g.contenido?.clips ?? []).map((c) => Number(c.videoId)).filter(Number.isInteger))]
  const filas = ids.length ? await db.select({ id: videos.id, duracion: videos.duracion }).from(videos).where(inArray(videos.id, ids)) : []
  const contenido = limpiarContenido(g.contenido, Object.fromEntries(filas.map((v) => [v.id, v.duracion ?? 0])))
  const [lista] = await db.select({ id: listas.id }).from(listas).where(eq(listas.id, contenido.listaId))
  if (!lista) contenido.listaId = 3
  const titulo = typeof g.titulo === 'string' && g.titulo.trim() ? g.titulo.trim().slice(0, 80) : 'Video'
  const textoPosteo = typeof g.textoPosteo === 'string' && g.textoPosteo.trim() ? g.textoPosteo.slice(0, 2200) : null
  await db.update(piezasVideo).set({ titulo, contenido, formatos: limpiarFormatosPropio(g.formatos), textoPosteo, actualizadoEn: new Date() }).where(eq(piezasVideo.id, Number(id)))
  revalidatePath('/creacion/piezas')
  return { ok: true as const, ...(await resumenPieza(Number(id))) }
}

/** Revisión, tiempos, franjas (con el precio ya calculado) y el texto automático del posteo. */
async function resumenPieza(id: number) {
  const d = await cargarPiezaVideo(id)
  if (!d) return { revision: { bloquean: ['Ese video ya no existe.'], avisos: [] }, tiempos: null, franjas: [], posteo: '' }
  const franjas = productosCapa(d)
  return {
    revision: revisar(d),
    tiempos: tiempos(d.contenido),
    franjas: d.contenido.productos.map((x) => {
      const p = d.productos.get(x.id)
      const f = franjas.find((y) => y.id === x.id)
      return { id: x.id, nombre: p?.nombre ?? `Producto ${x.id}`, foto: p?.foto ?? null, granel: !!p?.granel, presentaciones: p?.presentaciones.map((y) => y.tamano) ?? [], precio: f?.precio ?? null }
    }),
    posteo: posteoVideo(d),
  }
}
export type ResumenPieza = Awaited<ReturnType<typeof resumenPieza>>

export async function accionResumenPieza(id: number) {
  return resumenPieza(Number(id))
}

export async function accionDuplicarPiezaVideo(id: number): Promise<{ id: number } | { error: string }> {
  const [p] = await db.select().from(piezasVideo).where(eq(piezasVideo.id, Number(id)))
  if (!p) return { error: 'Ese video ya no existe.' }
  const [n] = await db.insert(piezasVideo).values({ titulo: `${p.titulo} (copia)`.slice(0, 80), contenido: p.contenido, formatos: p.formatos, textoPosteo: p.textoPosteo }).returning({ id: piezasVideo.id })
  revalidatePath('/creacion/piezas')
  return { id: n.id }
}

/** Borra la pieza (los videos de «Mis videos» quedan); si tiene algo programado o una pauta activa, dice por qué no. */
export async function accionBorrarPiezaVideo(id: number): Promise<{ ok: true } | { error: string }> {
  const r = await borrarPieza('video', Number(id))
  if (!r.ok) return { error: r.motivo }
  revalidatePath('/creacion/piezas')
  return { ok: true }
}
