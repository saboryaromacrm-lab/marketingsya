import 'server-only'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cola, COLA_SINCRONIZAR } from '@/lib/cola'

const { sincronizaciones } = esquema

/** Pone una sincronización en la cola. Si ya hay una en marcha, devuelve esa. */
export async function iniciarSincronizacion(): Promise<number> {
  const activa = await sincronizacionActiva()
  if (activa) return activa.id
  let id: number
  try {
    ;[{ id }] = await db.insert(sincronizaciones).values({ estado: 'en_cola', etapa: 'Esperando turno', avance: 0 }).returning({ id: sincronizaciones.id })
  } catch {
    // Dos clics casi simultáneos: la base no deja crear dos (índice único). Se devuelve la otra.
    const otra = await sincronizacionActiva()
    if (otra) return otra.id
    throw new Error('No se pudo iniciar la sincronización.')
  }
  try {
    await (await cola()).send(COLA_SINCRONIZAR, { id })
  } catch (e) {
    await db.update(sincronizaciones).set({ estado: 'error', error: 'No se pudo poner en la cola de tareas.', terminadaEn: new Date() }).where(eq(sincronizaciones.id, id))
    throw e
  }
  return id
}

export async function sincronizacionActiva() {
  const [fila] = await db.select().from(sincronizaciones).where(inArray(sincronizaciones.estado, ['en_cola', 'corriendo'])).limit(1)
  return fila ?? null
}

export async function ultimaSincronizacion() {
  const [fila] = await db.select().from(sincronizaciones).orderBy(desc(sincronizaciones.id)).limit(1)
  return fila ?? null
}

export async function ultimaSincronizacionBuena() {
  const [fila] = await db.select().from(sincronizaciones).where(inArray(sincronizaciones.estado, ['ok', 'sin_cambios'])).orderBy(desc(sincronizaciones.id)).limit(1)
  return fila ?? null
}
