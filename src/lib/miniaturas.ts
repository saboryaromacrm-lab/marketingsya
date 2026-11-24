// Miniaturas: la misma imagen de /media en un ancho chico, generada la primera vez que se pide y guardada
// (/media/mini/<ancho>/<ruta>). Sirve para todo lo que ya existe y lo que venga, sin pasos manuales.
// Puro: lo usan las pantallas (cliente y servidor) para armar las direcciones.

export const ANCHOS_MINI = [96, 160, 320, 640] as const
export type AnchoMini = (typeof ANCHOS_MINI)[number]

const RASTER = /\.(webp|jpe?g|png)$/i

export const esAnchoMini = (n: number): n is AnchoMini => (ANCHOS_MINI as readonly number[]).includes(n)

/** Se puede achicar: una imagen (no SVG) de /media que no sea ya una miniatura. */
export const achicable = (url: string) => url.startsWith('/media/') && !url.startsWith('/media/mini/') && RASTER.test(url.split('?')[0])

/** La dirección de la miniatura; si no se puede achicar, la original. */
export function mini(url: string, ancho: AnchoMini): string
export function mini(url: string | null | undefined, ancho: AnchoMini): string | null
export function mini(url: string | null | undefined, ancho: AnchoMini): string | null {
  if (!url) return null
  return achicable(url) ? `/media/mini/${ancho}/${url.slice('/media/'.length)}` : url
}

/**
 * Para un <img>: `mostrado` es lo que ocupa en pantalla (en píxeles). Usa la miniatura justa y, en pantallas de
 * alta densidad (celulares), la del doble. Si la imagen no se puede achicar, queda la original.
 */
export function imagenMini(url: string | null | undefined, mostrado: number): { src: string | undefined; srcSet: string | undefined } {
  if (!url) return { src: undefined, srcSet: undefined }
  if (!achicable(url)) return { src: url, srcSet: undefined }
  const mayor = ANCHOS_MINI[ANCHOS_MINI.length - 1]
  const base = ANCHOS_MINI.find((a) => a >= mostrado) ?? mayor
  const doble = ANCHOS_MINI.find((a) => a >= mostrado * 2) ?? mayor
  return { src: mini(url, base), srcSet: doble === base ? undefined : `${mini(url, base)} 1x, ${mini(url, doble)} 2x` }
}
