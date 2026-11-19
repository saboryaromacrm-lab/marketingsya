import 'server-only'
import { and, asc, desc, gte, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { estadoMeta } from '@/lib/meta/conexion'

const { publicaciones, publicacionDestinos } = esquema

/** Para Inicio: lo próximo que sale y lo que falló en la última semana (con el motivo). */
export async function resumenPublicaciones() {
  const semana = new Date(Date.now() - 7 * 864e5)
  const [proximas, [{ n }], fallidas, meta] = await Promise.all([
    db.select({ titulo: publicaciones.titulo, programadaPara: publicaciones.programadaPara }).from(publicaciones).where(inArray(publicaciones.estado, ['programada', 'reintentando'])).orderBy(asc(publicaciones.programadaPara)).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(publicaciones).where(inArray(publicaciones.estado, ['programada', 'reintentando'])),
    db
      .select({ id: publicaciones.id, titulo: publicaciones.titulo, error: sql<string | null>`(select ${publicacionDestinos.error} from ${publicacionDestinos} where ${publicacionDestinos.publicacionId} = ${publicaciones.id} and ${publicacionDestinos.estado} = 'error' limit 1)` })
      .from(publicaciones)
      .where(and(inArray(publicaciones.estado, ['error', 'parcial']), gte(publicaciones.terminadoEn, semana)))
      .orderBy(desc(publicaciones.terminadoEn))
      .limit(5),
    estadoMeta(),
  ])
  return { proxima: proximas[0] ?? null, programadas: n, fallidas, metaConectada: meta.conectada }
}
