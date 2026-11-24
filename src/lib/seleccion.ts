import 'server-only'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { urlMedia } from '@/lib/media'

const { seleccion, productos } = esquema

/** Los productos elegidos con las casillas del catálogo, en el orden en que se marcaron. */
export async function productosElegidos() {
  const filas = await db
    .select({ id: productos.id, nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`, foto: fotoEfectiva })
    .from(seleccion)
    .innerJoin(productos, eq(productos.id, seleccion.productoId))
    .orderBy(asc(seleccion.agregadoEn), asc(seleccion.productoId))
  return filas.map((f) => ({ ...f, foto: f.foto ? urlMedia(f.foto) : null }))
}
export type Elegido = Awaited<ReturnType<typeof productosElegidos>>[number]

// Solo se pueden elegir productos que sirven para piezas: con foto, activos y no excluidos.
async function elegibles(ids: number[]) {
  if (!ids.length) return []
  const filas = await db
    .select({ id: productos.id })
    .from(productos)
    .where(and(inArray(productos.id, ids), eq(productos.dadoDeBaja, false), eq(productos.excluirDePiezas, false), sql`${fotoEfectiva} is not null`))
  return filas.map((f) => f.id)
}

/** Marca o desmarca productos en la selección. No revalida: cada pantalla decide cómo mostrarse al día. */
export async function aplicarSeleccion(ids: number[], marcar: boolean) {
  const limpios = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500)
  if (marcar) {
    const ok = await elegibles(limpios)
    if (ok.length) await db.insert(seleccion).values(ok.map((productoId) => ({ productoId }))).onConflictDoNothing()
  } else if (limpios.length) {
    await db.delete(seleccion).where(inArray(seleccion.productoId, limpios))
  }
}
