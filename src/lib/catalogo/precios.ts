import type { Precio, ProductoNormalizado } from './tipos'

export const LISTA_MINORISTA = 3

export type PrecioElegido = Precio & { presentacion: string | null }

/**
 * Precio de un producto en una lista, para mostrar o para una pieza.
 * - Envasados: el precio propio de la lista (por unidad si hay varios).
 * - A granel: el precio propio por kilo si lo tiene; si no, el fraccionado de 1 kg;
 *   si no hay de 1 kg, el fraccionado más grande que tenga precio en esa lista.
 */
export function precioDeLista(p: Pick<ProductoNormalizado, 'precios' | 'presentaciones'>, listaId: number): PrecioElegido | null {
  const propios = p.precios.filter((x) => x.listaId === listaId)
  const propio = propios.find((x) => x.unidades === 1) ?? propios[0]
  if (propio) return { ...propio, presentacion: null }

  const conPrecio = p.presentaciones.filter((pr) => pr.precios.some((x) => x.listaId === listaId))
  const elegida = conPrecio.find((pr) => pr.kg === 1) ?? conPrecio[0] // ya vienen de mayor a menor
  if (!elegida) return null
  const x = elegida.precios.find((y) => y.listaId === listaId && y.unidades === 1) ?? elegida.precios.find((y) => y.listaId === listaId)!
  return { ...x, presentacion: elegida.tamano }
}
