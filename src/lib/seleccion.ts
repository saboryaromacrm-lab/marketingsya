import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
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
