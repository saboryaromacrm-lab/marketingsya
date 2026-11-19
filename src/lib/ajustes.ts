import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'

const { ajustes } = esquema

export type ClaveAjuste = 'clave_hash' | 'sesion_secreto' | 'logo' | 'configuracion' | 'ia_clave' | 'meta_token' | 'meta_cuentas'

export async function leerAjuste(clave: ClaveAjuste): Promise<string | null> {
  const [fila] = await db.select({ valor: ajustes.valor }).from(ajustes).where(eq(ajustes.clave, clave))
  return fila?.valor ?? null
}

export async function guardarAjuste(clave: ClaveAjuste, valor: string) {
  await db.insert(ajustes).values({ clave, valor }).onConflictDoUpdate({ target: ajustes.clave, set: { valor, actualizadoEn: sql`now()` } })
}

/** Guarda solo si todavía no existe. Devuelve false si ya había un valor (otro llegó primero). */
export async function guardarAjusteSiFalta(clave: ClaveAjuste, valor: string): Promise<boolean> {
  const filas = await db.insert(ajustes).values({ clave, valor }).onConflictDoNothing().returning({ clave: ajustes.clave })
  return filas.length > 0
}

export async function borrarAjuste(clave: ClaveAjuste) {
  await db.delete(ajustes).where(eq(ajustes.clave, clave))
}
