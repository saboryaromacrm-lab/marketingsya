import 'server-only'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'

// Después de 5 intentos fallidos desde la misma IP en 15 minutos, se bloquea
// esa IP hasta que pasen los 15 minutos desde el primer fallo de la ventana.
export const MAX_FALLOS = 5
export const VENTANA_MIN = 15

export async function minutosDeBloqueo(ip: string): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000)
  const [fila] = await db
    .select({ fallos: sql<number>`count(*)::int`, primero: sql<Date>`min(${esquema.intentosIngreso.creadoEn})` })
    .from(esquema.intentosIngreso)
    .where(and(eq(esquema.intentosIngreso.ip, ip), eq(esquema.intentosIngreso.exitoso, false), gt(esquema.intentosIngreso.creadoEn, desde)))
  if (!fila || fila.fallos < MAX_FALLOS) return 0
  const libera = new Date(fila.primero).getTime() + VENTANA_MIN * 60_000
  return Math.max(1, Math.ceil((libera - Date.now()) / 60_000))
}

export async function registrarIntento(ip: string, exitoso: boolean, navegador: string | null) {
  await db.insert(esquema.intentosIngreso).values({ ip, exitoso, navegador: navegador?.slice(0, 300) ?? null })
}
