// Reglas de la lista de productos del asistente de Creación (paso «¿Qué productos?»). Puras: se prueban solas
// y las usa también la pantalla.

import { MAX } from '@/lib/carruseles/tipos'

export type TipoPieza = 'nutriofertas' | 'lanzamiento' | 'receta' | 'promo' | 'destacado' | 'fecha'
export type OrdenLista = 'stock' | 'nombre' | 'precio-asc' | 'precio-desc' | 'nuevos'
export type FiltrosLista = {
  q: string
  marca: number | 'sin' | null
  categoria: string | null
  tipo: 'todos' | 'entero' | 'granel'
  nuevos: boolean
  bajaron: boolean
  conStock: boolean
  // null = las 4 sucursales juntas
  sucursal: number | null
  orden: OrdenLista
  pagina: number
}

export const POR_PAGINA_LISTA = 20
// «Nuevo»: apareció en el ERP en los últimos 30 días (sin contar la primera importación)
export const DIAS_NUEVOS = 30
export const ORDENES: Record<OrdenLista, string> = { stock: 'Mayor stock', nombre: 'Nombre A-Z', 'precio-asc': 'Precio: menor a mayor', 'precio-desc': 'Precio: mayor a menor', nuevos: 'Más nuevos' }

// Cuántos productos entran en cada pieza (Promo no tiene tope)
export const TOPE_POR_TIPO: Record<TipoPieza, number | null> = {
  nutriofertas: MAX.nutriProductos, lanzamiento: MAX.lanzamientoItems, receta: MAX.ingredientes, promo: null, destacado: 1, fecha: MAX.lanzamientoItems,
}

const BASE: FiltrosLista = { q: '', marca: null, categoria: null, tipo: 'todos', nuevos: false, bajaron: false, conStock: false, sucursal: null, orden: 'stock', pagina: 1 }

/** Cómo arranca la lista según lo que se va a comunicar. */
export function filtrosDeTipo(tipo: TipoPieza): FiltrosLista {
  // Lanzamiento y fecha especial: los productos nuevos a mano
  if (tipo === 'lanzamiento' || tipo === 'fecha') return { ...BASE, nuevos: true, orden: 'nuevos' }
  // Receta: ingredientes (a granel), los que más hay primero
  if (tipo === 'receta') return { ...BASE, tipo: 'granel' }
  return { ...BASE }
}

const esTipo = (x: unknown): x is TipoPieza => typeof x === 'string' && x in TOPE_POR_TIPO
export const tipoDe = (x: unknown): TipoPieza => (esTipo(x) ? x : 'nutriofertas')

type Params = Record<string, string | undefined>

/** Los filtros desde la dirección de la página (si no hay ninguno, los de entrada del tipo). */
export function leerFiltrosLista(p: Params, tipo: TipoPieza): FiltrosLista {
  const claves = ['q', 'marca', 'categoria', 'granel', 'nuevos', 'bajaron', 'stock', 'sucursal', 'orden', 'pag']
  if (!claves.some((k) => p[k] != null)) return filtrosDeTipo(tipo)
  const entero = (s: string | undefined) => { const n = Number(s); return Number.isInteger(n) && n > 0 ? n : null }
  return {
    q: (p.q ?? '').trim().slice(0, 80),
    marca: p.marca === 'sin' ? 'sin' : entero(p.marca),
    categoria: p.categoria?.trim() ? p.categoria.trim().slice(0, 80) : null,
    tipo: p.granel === 'si' ? 'granel' : p.granel === 'no' ? 'entero' : 'todos',
    nuevos: p.nuevos === '1',
    bajaron: p.bajaron === '1',
    conStock: p.stock === '1',
    sucursal: entero(p.sucursal),
    orden: p.orden && p.orden in ORDENES ? (p.orden as OrdenLista) : 'stock',
    pagina: entero(p.pag) ?? 1,
  }
}

/** Los filtros para la dirección de la página. Siempre se escribe algo, así al volver no se pisan con los de entrada. */
export function parametrosLista(f: FiltrosLista, tipo: TipoPieza): Record<string, string> {
  const r: Record<string, string> = { tipo }
  if (f.q) r.q = f.q
  if (f.marca != null) r.marca = String(f.marca)
  if (f.categoria) r.categoria = f.categoria
  if (f.tipo !== 'todos') r.granel = f.tipo === 'granel' ? 'si' : 'no'
  if (f.nuevos) r.nuevos = '1'
  if (f.bajaron) r.bajaron = '1'
  if (f.conStock) r.stock = '1'
  if (f.sucursal) r.sucursal = String(f.sucursal)
  r.orden = f.orden
  if (f.pagina > 1) r.pag = String(f.pagina)
  return r
}

/** Cuántos filtros hay puestos (para el botón «Filtros (2)» del celular). */
export const filtrosPuestos = (f: FiltrosLista) =>
  [f.marca != null, !!f.categoria, f.tipo !== 'todos', f.nuevos, f.bajaron, f.conStock, f.sucursal != null].filter(Boolean).length

/** «48 u.», «6,75 kg», «sin stock». */
export function textoStock(n: number, granel: boolean): string {
  if (!(n > 0)) return 'sin stock'
  const v = granel ? Math.round(n * 100) / 100 : Math.round(n)
  return `${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${granel ? 'kg' : 'u.'}`
}

/** Páginas para mostrar: 1 2 3 … 96, con la actual en el medio. */
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const r = new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total))
  if (actual <= 3) [2, 3, 4].forEach((n) => r.add(n))
  if (actual >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => r.add(n))
  const ord = [...r].sort((a, b) => a - b)
  const out: (number | null)[] = []
  ord.forEach((n, i) => { if (i && n - ord[i - 1] > 1) out.push(null); out.push(n) })
  return out
}

/**
 * Stock de un producto por sucursal: el suyo y, en los de granel, el de sus fraccionados pasado a kilos
 * (3 bolsas de 500 g = 1,5 kg). Sin números raros: lo que no es un número cuenta 0.
 */
export function stockPorSucursal(p: { tipo?: string; stock?: unknown; presentaciones?: unknown }): Record<string, number> {
  const r: Record<string, number> = {}
  const sumar = (s: unknown, factor: number) => {
    if (!s || typeof s !== 'object') return
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n > 0) r[k] = (r[k] ?? 0) + n * factor
    }
  }
  sumar(p.stock, 1)
  if (p.tipo === 'granel' && Array.isArray(p.presentaciones)) {
    for (const pr of p.presentaciones as { kg?: unknown; stock?: unknown }[]) {
      const kg = Number(pr?.kg)
      if (Number.isFinite(kg) && kg > 0) sumar(pr?.stock, kg)
    }
  }
  for (const k of Object.keys(r)) r[k] = Math.round(r[k] * 100) / 100
  return r
}

export const stockTotal = (s: Record<string, number>) => Math.round(Object.values(s).reduce((a, b) => a + b, 0) * 100) / 100
