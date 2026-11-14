// Filtros del listado de productos. Viven en la dirección de la página
// (/catalogo?q=aceite&marca=12&orden=precio-asc), así se pueden compartir y volver atrás.

import { LISTA_MINORISTA } from './precios'

export type Pestana = 'todos' | 'envasados' | 'granel' | 'baja'
export type Orden = 'relevancia' | 'nombre' | 'precio-asc' | 'precio-desc' | 'nuevos'

export type Filtros = {
  q: string
  pestana: Pestana
  categoria: string | null
  subcategoria: string | null
  marca: number | 'sin' | null
  etiqueta: string | null
  foto: 'con' | 'sin' | null
  sinPrecio: boolean
  lista: number
  orden: Orden
  pagina: number
}

export const POR_PAGINA = 50
const PESTANAS: Pestana[] = ['todos', 'envasados', 'granel', 'baja']
const ORDENES: Orden[] = ['relevancia', 'nombre', 'precio-asc', 'precio-desc', 'nuevos']

type Parametros = Record<string, string | string[] | undefined>
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null
const entero = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null)

export function leerFiltros(p: Parametros): Filtros {
  const q = (uno(p.q) ?? '').slice(0, 120)
  const pestana = PESTANAS.find((x) => x === uno(p.pestana)) ?? 'todos'
  const categoria = uno(p.categoria)
  const marcaTexto = uno(p.marca)
  const foto = uno(p.foto)
  const ordenPedido = ORDENES.find((x) => x === uno(p.orden))
  // Sin búsqueda no hay «relevancia»; con búsqueda, es el orden por defecto.
  const orden: Orden = ordenPedido && !(ordenPedido === 'relevancia' && !q) ? ordenPedido : q ? 'relevancia' : 'nombre'
  return {
    q,
    pestana,
    categoria,
    // La subcategoría solo tiene sentido dentro de una categoría
    subcategoria: categoria ? uno(p.subcategoria) : null,
    marca: marcaTexto === 'sin' ? 'sin' : entero(marcaTexto),
    etiqueta: uno(p.etiqueta),
    foto: foto === 'con' || foto === 'sin' ? foto : null,
    sinPrecio: uno(p.sinprecio) === '1',
    lista: entero(uno(p.lista)) ?? LISTA_MINORISTA,
    orden,
    pagina: Math.max(1, Math.min(10_000, entero(uno(p.pagina)) ?? 1)),
  }
}

/** Arma la dirección con los filtros, sin los valores por defecto (direcciones cortas). */
export function urlConFiltros(f: Filtros, cambios: Partial<Filtros> = {}, base = '/catalogo'): string {
  const x = { ...f, ...cambios }
  // Cualquier cambio de filtro vuelve a la página 1, salvo que se pida otra
  if (!('pagina' in cambios)) x.pagina = 1
  const q = new URLSearchParams()
  if (x.q) q.set('q', x.q)
  if (x.pestana !== 'todos') q.set('pestana', x.pestana)
  if (x.categoria) q.set('categoria', x.categoria)
  if (x.categoria && x.subcategoria) q.set('subcategoria', x.subcategoria)
  if (x.marca != null) q.set('marca', String(x.marca))
  if (x.etiqueta) q.set('etiqueta', x.etiqueta)
  if (x.foto) q.set('foto', x.foto)
  if (x.sinPrecio) q.set('sinprecio', '1')
  if (x.lista !== LISTA_MINORISTA) q.set('lista', String(x.lista))
  if (x.orden !== (x.q ? 'relevancia' : 'nombre')) q.set('orden', x.orden)
  if (x.pagina > 1) q.set('pagina', String(x.pagina))
  const s = q.toString()
  return s ? `${base}?${s}` : base
}
