'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { armarIndice, emparejar, type Emparejado } from '@/lib/catalogo/emparejar'
import { leerConfig } from '@/lib/configuracion'
import { leerFiltros } from '@/lib/catalogo/filtros'
import { condicionFiltrados } from '@/lib/catalogo/listado'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'

const { productos } = esquema
const LARGO_MAXIMO_NOMBRE = 120

/** Nombre para piezas. Vacío = usar el sugerido. */
export async function guardarNombrePiezas(id: number, nombre: string): Promise<{ ok: true; nombre: string | null } | { error: string }> {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length > LARGO_MAXIMO_NOMBRE) return { error: `Máximo ${LARGO_MAXIMO_NOMBRE} caracteres.` }
  const [p] = await db.update(productos).set({ nombrePiezas: limpio || null }).where(eq(productos.id, id)).returning({ nombre: productos.nombrePiezas })
  if (!p) return { error: 'Ese producto no existe.' }
  revalidatePath(`/catalogo/${id}`)
  return { ok: true, nombre: p.nombre }
}

export async function cambiarExclusion(id: number, excluir: boolean) {
  await db.update(productos).set({ excluirDePiezas: excluir }).where(eq(productos.id, id))
  revalidatePath('/catalogo', 'layout')
}

/** «No usar en piezas» (o volver a usar) para todos los productos del filtro actual. */
export async function excluirFiltrados(consulta: string, excluir: boolean): Promise<{ cambiados: number }> {
  const f = leerFiltros(Object.fromEntries(new URLSearchParams(consulta)), (await leerConfig()).piezas.listaId)
  const filas = await db.update(productos).set({ excluirDePiezas: excluir }).where(condicionFiltrados(f)).returning({ id: productos.id })
  revalidatePath('/catalogo', 'layout')
  return { cambiados: filas.length }
}

export type ResultadoEmparejado = Emparejado & { producto?: { id: number; nombre: string; foto: string | null; fotoPropia: boolean; dadoDeBaja: boolean } }

/** Fotos en lote: a qué producto va cada archivo. Solo nombres, todavía no se sube nada. */
export async function emparejarFotos(nombres: string[]): Promise<ResultadoEmparejado[]> {
  const filas = await db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      codigo: productos.codigo,
      codigoBarras: productos.codigoBarras,
      dun: sql<string>`coalesce(${productos.erp} ->> 'dun', '')`,
      barrasFraccionados: sql<string[]>`coalesce((select array_agg(pr ->> 'codigoBarras') from jsonb_array_elements(${productos.erp} -> 'presentaciones') pr), '{}')`,
      foto: fotoEfectiva,
      fotoPropia: sql<boolean>`${productos.imagenPropiaCuadrada} is not null`,
      dadoDeBaja: productos.dadoDeBaja,
    })
    .from(productos)
  const porId = new Map(filas.map((f) => [f.id, f]))
  const indice = armarIndice(filas.map((f) => ({ id: f.id, codigo: f.codigo, codigosBarras: [f.codigoBarras, f.dun, ...f.barrasFraccionados].filter(Boolean) })))
  return emparejar(nombres.slice(0, 300), indice).map((r) => {
    const id = r.estado === 'ok' || r.estado === 'repetido' ? r.productoId : null
    const p = id ? porId.get(id) : undefined
    return p ? { ...r, producto: { id: p.id, nombre: p.nombre, foto: p.foto, fotoPropia: p.fotoPropia, dadoDeBaja: p.dadoDeBaja } } : r
  })
}
