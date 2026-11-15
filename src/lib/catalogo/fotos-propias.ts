import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { borrarMedia, guardarMedia } from '@/lib/media'
import { procesarFoto } from './fotos'

const { productos } = esquema

// Foto que se usa: la de Lucas (versión cuadrada) si la hay; si no, la del ERP.
export const fotoEfectiva = sql<string | null>`coalesce(${productos.imagenPropiaCuadrada}, ${productos.imagenArchivo})`

export class ProductoInexistente extends Error {}

/** Procesa y guarda la foto de Lucas para un producto. Reemplaza la anterior, la del ERP queda intacta. */
export async function guardarFotoPropia(productoId: number, datos: Buffer) {
  const [p] = await db
    .select({ id: productos.id, archivo: productos.imagenPropiaArchivo, cuadrada: productos.imagenPropiaCuadrada })
    .from(productos)
    .where(eq(productos.id, productoId))
  if (!p) throw new ProductoInexistente()

  const { original, cuadrada, ancho, alto } = await procesarFoto(datos)
  const sello = Date.now()
  const rutaOriginal = `propias/productos/${productoId}-${sello}.webp`
  const rutaCuadrada = `propias/productos/${productoId}-${sello}-cuadrada.webp`
  await guardarMedia(rutaOriginal, original)
  await guardarMedia(rutaCuadrada, cuadrada)
  await db
    .update(productos)
    .set({ imagenPropiaArchivo: rutaOriginal, imagenPropiaCuadrada: rutaCuadrada, imagenPropiaEn: new Date() })
    .where(eq(productos.id, productoId))
  await borrarMedia(p.archivo)
  await borrarMedia(p.cuadrada)
  return { ancho, alto, cuadrada: rutaCuadrada }
}

/** Saca la foto de Lucas: el producto vuelve a usar la del ERP (si tiene). */
export async function quitarFotoPropia(productoId: number) {
  const [p] = await db
    .select({ archivo: productos.imagenPropiaArchivo, cuadrada: productos.imagenPropiaCuadrada })
    .from(productos)
    .where(eq(productos.id, productoId))
  if (!p) throw new ProductoInexistente()
  await db.update(productos).set({ imagenPropiaArchivo: null, imagenPropiaCuadrada: null, imagenPropiaEn: null }).where(eq(productos.id, productoId))
  await borrarMedia(p.archivo)
  await borrarMedia(p.cuadrada)
}
