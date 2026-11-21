import 'server-only'
import { asc } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { urlMedia } from '@/lib/media'

/** La biblioteca de música (para elegir en los videos). */
export async function listarMusica() {
  const filas = await db.select().from(esquema.musica).orderBy(asc(esquema.musica.nombre))
  return filas.map((m) => ({ id: m.id, nombre: m.nombre, duracion: m.duracion, url: urlMedia(m.archivo) }))
}
export type TemaMusica = Awaited<ReturnType<typeof listarMusica>>[number]
