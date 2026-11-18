'use server'

import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { encolarExportacion, limpiarExportaciones } from '@/lib/piezas/exportar'

const { productos } = esquema

/** Arma un carrusel de prueba con 3 productos al azar (con foto y precio) para ver que Chromium anda. */
export async function probarMotor(): Promise<{ id: number } | { error: string }> {
  const elegidos = await db
    .select({ id: productos.id })
    .from(productos)
    .where(and(eq(productos.dadoDeBaja, false), eq(productos.excluirDePiezas, false), sql`${fotoEfectiva} is not null`, isNotNull(productos.precioMinorista)))
    .orderBy(sql`random()`)
    .limit(3)
  if (elegidos.length < 3) return { error: 'Hacen falta al menos 3 productos con foto y precio. Sincronizá el catálogo primero.' }
  await limpiarExportaciones('prueba', 2)
  const lista = elegidos.map((p) => p.id).join(',')
  const placas = [1, 2, 3, 4, 5].map((n) => `/render/prueba/${n}?productos=${lista}`)
  try {
    return { id: await encolarExportacion('prueba', placas) }
  } catch {
    return { error: 'No se pudo iniciar la prueba.' }
  }
}
