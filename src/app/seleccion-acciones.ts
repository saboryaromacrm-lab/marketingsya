'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'

const { seleccion, productos } = esquema

// Solo se pueden elegir productos que sirven para piezas: con foto, activos y no excluidos.
async function elegibles(ids: number[]) {
  if (!ids.length) return []
  const filas = await db
    .select({ id: productos.id })
    .from(productos)
    .where(and(inArray(productos.id, ids), eq(productos.dadoDeBaja, false), eq(productos.excluirDePiezas, false), sql`${fotoEfectiva} is not null`))
  return filas.map((f) => f.id)
}

export async function marcarProductos(ids: number[], marcar: boolean) {
  const limpios = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500)
  if (marcar) {
    const ok = await elegibles(limpios)
    if (ok.length) await db.insert(seleccion).values(ok.map((productoId) => ({ productoId }))).onConflictDoNothing()
  } else if (limpios.length) {
    await db.delete(seleccion).where(inArray(seleccion.productoId, limpios))
  }
  revalidatePath('/', 'layout')
}

export async function vaciarSeleccion() {
  await db.delete(seleccion)
  revalidatePath('/', 'layout')
}
