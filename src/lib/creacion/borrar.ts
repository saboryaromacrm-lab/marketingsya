import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { borrarMedia } from '@/lib/media'
import { archivosDe, bloqueoParaBorrar, type Bloqueo, type TipoPieza } from './borrar-reglas'

const { carruseles, promos, piezasVideo, exportaciones, publicaciones, pautas } = esquema
const TABLA = { carrusel: carruseles, promo: promos, video: piezasVideo } as const

export type ResultadoBorrar = { ok: true } | ({ ok: false; titulo: string } & Bloqueo)

/** El título de la pieza, o null si ya no existe. */
export async function tituloPieza(tipo: TipoPieza, id: number): Promise<string | null> {
  const t = TABLA[tipo]
  const [f] = await db.select({ titulo: t.titulo }).from(t).where(eq(t.id, id))
  return f?.titulo ?? null
}

/** ¿Siguen existiendo estas piezas? (para marcar «pieza borrada» en Publicaciones). */
export async function piezasExistentes(piezas: { tipo: TipoPieza; id: number }[]): Promise<Set<string>> {
  const existen = new Set<string>()
  for (const tipo of Object.keys(TABLA) as TipoPieza[]) {
    const ids = [...new Set(piezas.filter((p) => p.tipo === tipo).map((p) => p.id))]
    if (!ids.length) continue
    const t = TABLA[tipo]
    for (const f of await db.select({ id: t.id }).from(t).where(inArray(t.id, ids))) existen.add(`${tipo}-${f.id}`)
  }
  return existen
}

/**
 * Borra una pieza con sus exportaciones y sus archivos (libera espacio). No la borra si tiene una publicación
 * programada, una pauta activa o una exportación en curso: devuelve el motivo y dónde resolverlo.
 * Lo ya publicado queda en Instagram y Facebook, y su registro en Publicaciones.
 */
export async function borrarPieza(tipo: TipoPieza, id: number): Promise<ResultadoBorrar> {
  const titulo = await tituloPieza(tipo, id)
  if (titulo == null) return { ok: true } // Ya no estaba
  const pubs = await db.select({ id: publicaciones.id, estado: publicaciones.estado }).from(publicaciones).where(and(eq(publicaciones.tipo, tipo), eq(publicaciones.referenciaId, id)))
  const pts = pubs.length ? await db.select({ estado: pautas.estado }).from(pautas).where(inArray(pautas.publicacionId, pubs.map((p) => p.id))) : []
  const exps = await db.select().from(exportaciones).where(and(eq(exportaciones.tipo, tipo), eq(exportaciones.referenciaId, id)))
  const bloqueo = bloqueoParaBorrar({ publicaciones: pubs.map((p) => p.estado), pautas: pts.map((p) => p.estado), exportaciones: exps.map((e) => e.estado) })
  if (bloqueo) return { ok: false, titulo, ...bloqueo }

  const t = TABLA[tipo]
  await db.transaction(async (tx) => {
    if (exps.length) await tx.delete(exportaciones).where(inArray(exportaciones.id, exps.map((e) => e.id)))
    await tx.delete(t).where(eq(t.id, id))
  })
  // Los archivos, recién cuando la base ya no los nombra
  for (const a of archivosDe(exps)) await borrarMedia(a)
  return { ok: true }
}

