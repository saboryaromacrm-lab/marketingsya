import { describe, expect, it } from 'vitest'
import datos from './datos/catalogo-chico.json'
import { CatalogoInvalido, normalizarCatalogo, unificarVariantes } from '../normalizar'
import { precioDeLista } from '../precios'
import { compararProducto, huella } from '../comparar'

const cat = normalizarCatalogo(datos)
const prod = (id: number) => cat.productos.find((p) => p.id === id)!
const listas = new Map(cat.listas.map((l) => [l.id, l.nombre]))
const copia = <T>(x: T): T => structuredClone(x)

describe('normalizarCatalogo', () => {
  it('rechaza una respuesta que no es el catálogo', () => {
    expect(() => normalizarCatalogo({ error: 'caído' })).toThrow(CatalogoInvalido)
    expect(() => normalizarCatalogo(null)).toThrow(CatalogoInvalido)
  })
  it('descarta productos sin id o sin nombre, sin frenar el resto', () => {
    const r = normalizarCatalogo({ ...datos, productos: [...datos.productos, { id: 'x' }, { id: 9, nombre: ' ' }] })
    expect(r.descartados).toBe(2)
    expect(r.productos).toHaveLength(datos.productos.length)
  })
  it('arregla la marca mal codificada', () => {
    expect(cat.marcas.find((m) => m.nombreErp.includes('Ã'))?.nombre).toBe('MAÑANITA')
  })
  it('unifica etiquetas que difieren en la tilde y saca las sueltas', () => {
    const todas = new Set(cat.productos.flatMap((p) => p.etiquetas))
    expect(todas.has('SIN AZUCAR')).toBe(false)
    expect(todas.has('SIN AZÚCAR')).toBe(true)
    expect(todas.has('SIN')).toBe(false)
  })
  it('unifica subcategorías que difieren en mayúsculas', () => {
    const subs = new Set(cat.productos.map((p) => p.subcategoria))
    expect(subs.has('Frutas Deshidratadas') && subs.has('Frutas deshidratadas')).toBe(false)
  })
  it('sin categoría queda null, no texto vacío', () => {
    expect(cat.productos.every((p) => p.categoria !== '')).toBe(true)
  })
  it('lee la versión de la foto y marca las que no tienen', () => {
    expect(prod(2398).imagen).toBeNull()
    expect(prod(2410).imagen?.version).toMatch(/^\d+$/)
  })
  it('granel sin marca queda con marcaId null', () => {
    expect(prod(137).marcaId).toBeNull()
    expect(prod(137).tipo).toBe('granel')
  })
})

describe('unificarVariantes', () => {
  it('prefiere la variante con tilde aunque sea menos usada', () => {
    const m = unificarVariantes(['SIN AZUCAR', 'SIN AZUCAR', 'SIN AZÚCAR'])
    expect(m.get('SIN AZUCAR')).toBe('SIN AZÚCAR')
  })
  it('sin tildes, gana la más usada', () => {
    const m = unificarVariantes(['Frutas deshidratadas', 'Frutas deshidratadas', 'Frutas Deshidratadas'])
    expect(m.get('Frutas Deshidratadas')).toBe('Frutas deshidratadas')
  })
})

describe('precioDeLista', () => {
  it('envasado: precio minorista propio', () => {
    expect(precioDeLista(prod(2410), 3)?.presentacion).toBeNull()
  })
  it('granel: usa el fraccionado de 1 kg', () => {
    expect(precioDeLista(prod(137), 3)).toMatchObject({ presentacion: '1 kg', precio: 8705 })
  })
  it('mayorista por bulto: precio por unidad, con las unidades del bulto', () => {
    const p = precioDeLista(prod(543), 1)!
    expect(p.unidades).toBe(12)
    expect(p.precioFormato).toBe(p.precio * 12)
  })
  it('sin precio en esa lista: null', () => {
    expect(precioDeLista(prod(2398), 1)).toBeNull()
  })
})

describe('compararProducto', () => {
  it('sin cambios: misma huella y ninguna diferencia', () => {
    expect(huella(prod(2410))).toBe(huella(copia(prod(2410))))
    expect(compararProducto(prod(2410), copia(prod(2410)), listas)).toEqual([])
  })
  it('detecta cambio de precio con el antes y el después', () => {
    const nuevo = copia(prod(2410))
    nuevo.precios[0].precio += 500
    const [c] = compararProducto(prod(2410), nuevo, listas)
    expect(c.tipo).toBe('precio')
    expect(c.antes).toEqual({ Minorista: prod(2410).precios[0].precio })
    expect(c.despues).toEqual({ Minorista: prod(2410).precios[0].precio + 500 })
  })
  it('detecta precio de fraccionado y foto nueva', () => {
    const nuevo = copia(prod(137))
    nuevo.presentaciones[1].precios[0].precio = 1
    nuevo.imagen = { url: 'https://x/y?v=2', version: '2' }
    const tipos = compararProducto(prod(137), nuevo, listas).map((c) => c.tipo)
    expect(tipos).toEqual(expect.arrayContaining(['precio', 'foto']))
  })
  it('un nombre sugerido distinto no cuenta como cambio del ERP', () => {
    const nuevo = copia(prod(2410))
    nuevo.nombreSugerido = 'otro'
    expect(huella(nuevo)).toBe(huella(prod(2410)))
  })
})
