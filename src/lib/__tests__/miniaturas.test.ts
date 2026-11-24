import { describe, expect, it } from 'vitest'
import { achicable, imagenMini, mini } from '../miniaturas'

describe('miniaturas', () => {
  it('solo achica imágenes de /media que no sean SVG ni ya miniaturas', () => {
    expect(achicable('/media/erp/productos/1-2.webp')).toBe(true)
    expect(achicable('/media/piezas/5/feed-1.jpg')).toBe(true)
    expect(achicable('/media/erp/marcas/3.png')).toBe(true)
    expect(achicable('/marca/circular-verde.svg')).toBe(false)
    expect(achicable('/media/logo.svg')).toBe(false)
    expect(achicable('/media/mini/96/erp/productos/1.webp')).toBe(false)
    expect(achicable('https://otro.com/x.jpg')).toBe(false)
  })
  it('arma la dirección de la miniatura', () => {
    expect(mini('/media/erp/productos/1-2.webp', 96)).toBe('/media/mini/96/erp/productos/1-2.webp')
    expect(mini('/marca/x.svg', 96)).toBe('/marca/x.svg')
    expect(mini(null, 96)).toBeNull()
  })
  it('elige el ancho justo y el doble para pantallas de celular', () => {
    expect(imagenMini('/media/a.webp', 38)).toEqual({ src: '/media/mini/96/a.webp', srcSet: undefined })
    expect(imagenMini('/media/a.webp', 72)).toEqual({ src: '/media/mini/96/a.webp', srcSet: '/media/mini/96/a.webp 1x, /media/mini/160/a.webp 2x' })
    expect(imagenMini('/media/p/feed-1.jpg', 300)).toEqual({ src: '/media/mini/320/p/feed-1.jpg', srcSet: '/media/mini/320/p/feed-1.jpg 1x, /media/mini/640/p/feed-1.jpg 2x' })
    expect(imagenMini('/media/a.webp', 1000)).toEqual({ src: '/media/mini/640/a.webp', srcSet: undefined })
  })
  it('sin imagen o no achicable: queda como está', () => {
    expect(imagenMini(null, 48)).toEqual({ src: undefined, srcSet: undefined })
    expect(imagenMini('/marca/x.svg', 48)).toEqual({ src: '/marca/x.svg', srcSet: undefined })
  })
})
