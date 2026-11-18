import 'server-only'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'

// Dos frenos contra quien prueba PINs al azar:
// 1. Por IP: 5 fallos en 15 minutos bloquean esa IP hasta que pasen los 15 minutos.
// 2. General: 20 fallos en una hora, desde cualquier IP, bloquean el ingreso hasta que pase la hora.
//    Con un PIN de 4 dígitos (10.000 combinaciones) esto lleva un ataque a semanas aunque use
//    muchas IP. A Lucas casi no lo afecta: la sesión dura 30 días en cada dispositivo.
export const MAX_FALLOS = 5
export const VENTANA_MIN = 15
export const MAX_FALLOS_GENERAL = 20
export const VENTANA_GENERAL_MIN = 60

const { intentosIngreso } = esquema

async function bloqueo(ventanaMin: number, maximo: number, ip?: string): Promise<number> {
  const desde = new Date(Date.now() - ventanaMin * 60_000)
  const [fila] = await db
    .select({ fallos: sql<number>`count(*)::int`, primero: sql<Date>`min(${intentosIngreso.creadoEn})` })
    .from(intentosIngreso)
    .where(and(ip ? eq(intentosIngreso.ip, ip) : undefined, eq(intentosIngreso.exitoso, false), gt(intentosIngreso.creadoEn, desde)))
  if (!fila || fila.fallos < maximo) return 0
  const libera = new Date(fila.primero).getTime() + ventanaMin * 60_000
  return Math.max(1, Math.ceil((libera - Date.now()) / 60_000))
}

export async function minutosDeBloqueo(ip: string): Promise<number> {
  const [porIp, general] = await Promise.all([bloqueo(VENTANA_MIN, MAX_FALLOS, ip), bloqueo(VENTANA_GENERAL_MIN, MAX_FALLOS_GENERAL)])
  return Math.max(porIp, general)
}

export async function registrarIntento(ip: string, exitoso: boolean, navegador: string | null) {
  await db.insert(intentosIngreso).values({ ip, exitoso, navegador: navegador?.slice(0, 300) ?? null })
}
