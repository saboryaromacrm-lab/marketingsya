// Texto de búsqueda de cada producto: todo en minúscula y sin tildes, para que
// «yerba mañanita», «YERBA MANANITA» y «Yerba Mañanita» encuentren lo mismo.

import type { ProductoNormalizado } from './tipos'

export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%/.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Todo lo que se puede buscar de un producto, en un solo texto. Empieza por el nombre (sirve para ordenar). */
export function textoDeBusqueda(p: ProductoNormalizado, marca: string | null): string {
  const partes = [
    p.nombre,
    p.nombreSugerido,
    marca ?? '',
    p.categoria ?? '',
    p.subcategoria ?? '',
    ...p.etiquetas,
    p.tipo === 'granel' ? 'granel suelto' : '',
    p.codigo,
    p.codigoBarras,
    p.dun,
    ...p.presentaciones.map((pr) => `${pr.tamano} ${pr.codigoBarras}`),
  ]
  // Sin repetir palabras: el nombre y el sugerido comparten casi todo
  const vistas = new Set<string>()
  const palabras: string[] = []
  for (const w of normalizarTexto(partes.join(' ')).split(' ')) {
    if (w && !vistas.has(w)) {
      vistas.add(w)
      palabras.push(w)
    }
  }
  return palabras.join(' ')
}

export const MAXIMO_PALABRAS = 8

/** Palabras de lo que escribió Lucas, listas para buscar. */
export function palabrasDeBusqueda(q: string | undefined | null): string[] {
  if (!q) return []
  return [...new Set(normalizarTexto(q).split(' ').map((w) => w.replace(/^[.,/-]+|[.,/-]+$/g, '')).filter(Boolean))].slice(0, MAXIMO_PALABRAS)
}
