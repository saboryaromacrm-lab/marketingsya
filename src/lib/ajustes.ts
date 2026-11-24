import 'server-only'
import { cache } from 'react'
import { eq, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'

const { ajustes } = esquema

export type ClaveAjuste = 'clave_hash' | 'sesion_secreto' | 'logo' | 'configuracion' | 'ia_clave' | 'meta_token' | 'meta_cuentas' | 'meta_publicidad'

// Una sola lectura por pedido: la tabla tiene pocas filas y una página necesitaba hasta 6 claves (logo, configuración,
// IA, Meta…), así que se lee entera una vez. Si en el mismo pedido se guarda o se borra un ajuste, cambia la versión
// y la próxima lectura va a la base: nunca se lee un valor viejo. Fuera de una página (cola, rutas) cache() no guarda
// nada y cada lectura va a la base, como antes.
let version = 0
const leerTodos = cache(async (_version: number): Promise<Map<string, string>> => {
  const filas = await db.select({ clave: ajustes.clave, valor: ajustes.valor }).from(ajustes)
  return new Map(filas.map((f) => [f.clave, f.valor]))
})
const cambio = () => { version++ }

export async function leerAjuste(clave: ClaveAjuste): Promise<string | null> {
  return (await leerTodos(version)).get(clave) ?? null
}

export async function guardarAjuste(clave: ClaveAjuste, valor: string) {
  await db.insert(ajustes).values({ clave, valor }).onConflictDoUpdate({ target: ajustes.clave, set: { valor, actualizadoEn: sql`now()` } })
  cambio()
}

/** Guarda solo si todavía no existe. Devuelve false si ya había un valor (otro llegó primero). */
export async function guardarAjusteSiFalta(clave: ClaveAjuste, valor: string): Promise<boolean> {
  const filas = await db.insert(ajustes).values({ clave, valor }).onConflictDoNothing().returning({ clave: ajustes.clave })
  cambio()
  return filas.length > 0
}

export async function borrarAjuste(clave: ClaveAjuste) {
  await db.delete(ajustes).where(eq(ajustes.clave, clave))
  cambio()
}
