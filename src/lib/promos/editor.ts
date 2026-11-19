import 'server-only'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { urlMedia } from '@/lib/media'
import type { DisenoPromo, FormatosPromo, ItemFila, TipoFila } from '@/lib/db/esquema'
import { detalleBase } from './calculo'
import { cargarPromo, planDePlacas, rutaPlaca } from './datos'

const { productos, listas, promos } = esquema

// Lo que el editor necesita de cada producto: nombre, foto, fraccionados (granel) y precio base
// (con su unidad: «c/u», «el kg», «x250 g») por lista y por fraccionado ('' = el de siempre).
export type BaseProducto = { precio: number; unidad: string } | null
export type InfoProducto = { id: number; nombre: string; foto: string | null; granel: boolean; presentaciones: string[]; bases: Record<string, Record<string, BaseProducto>> }

export async function infoProductos(ids: number[]): Promise<Record<number, InfoProducto>> {
  if (!ids.length) return {}
  const [filas, lsts] = await Promise.all([
    db
      .select({ id: productos.id, nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`, foto: fotoEfectiva, erp: productos.erp, tipo: productos.tipo })
      .from(productos)
      .where(inArray(productos.id, ids)),
    db.select({ id: listas.id }).from(listas),
  ])
  return Object.fromEntries(
    filas.map((p) => {
      const presentaciones = p.erp.presentaciones.map((pr) => pr.tamano)
      const granel = p.tipo === 'granel'
      const bases = Object.fromEntries(lsts.map((l) => [String(l.id), Object.fromEntries(['', ...presentaciones].map((pr) => [pr, detalleBase(p.erp, granel, l.id, pr || null)]))]))
      return [p.id, { id: p.id, nombre: p.nombre, foto: p.foto ? urlMedia(p.foto) : null, granel: p.tipo === 'granel', presentaciones, bases }]
    }),
  )
}

export type FilaEditor = { tipo: TipoFila; titulo: string | null; descuento: number | null; cantidadMinima: number | null; precioFijo: number | null; origen: 'manual' | 'erp'; productos: ItemFila[] }
export type DatosEditor = { titulo: string; desde: string; hasta: string; listaId: number; diseno: DisenoPromo; formatos: FormatosPromo; textoPosteo: string | null; filas: FilaEditor[] }

/** Placas que salen (para la vista previa) con su dirección. */
export async function placasDe(id: number) {
  const d = await cargarPromo(id)
  if (!d) return []
  return planDePlacas(d).map((p) => ({ formato: p.formato, pagina: p.pagina, paginas: p.paginas, ruta: rutaPlaca(id, p) }))
}

/** Para alternar los dos diseños: la promo nueva toma el contrario de la última. */
export async function disenoSiguiente(): Promise<DisenoPromo> {
  const [ultima] = await db.select({ diseno: promos.diseno }).from(promos).orderBy(desc(promos.id)).limit(1)
  return ultima?.diseno === '1' ? '2' : '1'
}

export async function listasDisponibles() {
  return db.select({ id: listas.id, nombre: listas.nombre, modalidad: listas.modalidad }).from(listas).orderBy(listas.orden, listas.id)
}

export async function existePromo(id: number) {
  const [p] = await db.select({ id: promos.id }).from(promos).where(eq(promos.id, id))
  return !!p
}

/** Historial de promos con lo que muestra la lista: cuántas filas y productos, y el último .zip. */
export async function listarPromos() {
  const { exportaciones, promoFilas } = esquema
  return db
    .select({
      id: promos.id,
      titulo: promos.titulo,
      desde: promos.desde,
      hasta: promos.hasta,
      diseno: promos.diseno,
      actualizadoEn: promos.actualizadoEn,
      filas: sql<number>`(select count(*)::int from ${promoFilas} where ${promoFilas.promoId} = ${promos.id})`,
      productos: sql<number>`(select coalesce(sum(jsonb_array_length(${promoFilas.productos})), 0)::int from ${promoFilas} where ${promoFilas.promoId} = ${promos.id})`,
      zip: exportaciones.zip,
      estadoExportacion: exportaciones.estado,
    })
    .from(promos)
    .leftJoin(exportaciones, eq(exportaciones.id, promos.exportacionId))
    .orderBy(desc(promos.actualizadoEn))
    .limit(200)
}

export async function ultimaExportacion(id: number | null) {
  if (!id) return null
  const { exportaciones } = esquema
  const [x] = await db.select({ id: exportaciones.id, estado: exportaciones.estado, zip: exportaciones.zip, terminadoEn: exportaciones.terminadoEn }).from(exportaciones).where(eq(exportaciones.id, id))
  return x ? { ...x, zip: x.zip ? urlMedia(x.zip) : null } : null
}

export async function cantidadElegidos() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(esquema.seleccion)
  return n
}
