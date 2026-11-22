import { describe, expect, it } from 'vitest'
import { filtrosDeTipo, filtrosPuestos, leerFiltrosLista, paginasVisibles, parametrosLista, stockPorSucursal, stockTotal, textoStock, TOPE_POR_TIPO } from '../lista-piezas-reglas'

describe('lista del asistente: filtros de entrada según el tipo', () => {
  it('Lanzamiento y fecha especial arrancan con los nuevos', () => {
    expect(filtrosDeTipo('lanzamiento')).toMatchObject({ nuevos: true, orden: 'nuevos' })
    expect(filtrosDeTipo('fecha')).toMatchObject({ nuevos: true })
  })
  it('NutriOfertas, Promo y destacado: mayor stock, sin filtros', () => {
    for (const t of ['nutriofertas', 'promo', 'destacado'] as const) expect(filtrosDeTipo(t)).toMatchObject({ orden: 'stock', nuevos: false, tipo: 'todos' })
  })
  it('Receta: a granel', () => {
    expect(filtrosDeTipo('receta')).toMatchObject({ tipo: 'granel', orden: 'stock' })
  })
  it('topes: lo que entra en cada pieza', () => {
    expect(TOPE_POR_TIPO).toEqual({ nutriofertas: 6, lanzamiento: 6, receta: 5, promo: null, destacado: 1, fecha: 6 })
  })
})

describe('lista del asistente: dirección de la página', () => {
  it('sin parámetros, los de entrada del tipo', () => {
    expect(leerFiltrosLista({}, 'lanzamiento').nuevos).toBe(true)
  })
  it('ida y vuelta', () => {
    const f = { ...filtrosDeTipo('nutriofertas'), q: 'mani', marca: 12, categoria: 'Untables y Dulces', tipo: 'granel' as const, bajaron: true, conStock: true, sucursal: 2, orden: 'precio-asc' as const, pagina: 3 }
    const p = parametrosLista(f, 'nutriofertas')
    expect(p).toMatchObject({ tipo: 'nutriofertas', q: 'mani', marca: '12', granel: 'si', bajaron: '1', stock: '1', sucursal: '2', orden: 'precio-asc', pag: '3' })
    expect(leerFiltrosLista(p, 'nutriofertas')).toEqual(f)
  })
  it('con los filtros sacados en Lanzamiento, al volver no se vuelven a poner los nuevos', () => {
    const p = parametrosLista({ ...filtrosDeTipo('lanzamiento'), nuevos: false, orden: 'stock' }, 'lanzamiento')
    expect(leerFiltrosLista(p, 'lanzamiento').nuevos).toBe(false)
  })
  it('valores raros se ignoran', () => {
    const f = leerFiltrosLista({ marca: 'x', orden: 'raro', pag: '-2', sucursal: '0', granel: 'quizas' }, 'promo')
    expect(f).toMatchObject({ marca: null, orden: 'stock', pagina: 1, sucursal: null, tipo: 'todos' })
    expect(leerFiltrosLista({ marca: 'sin' }, 'promo').marca).toBe('sin')
  })
  it('cuenta los filtros puestos', () => {
    expect(filtrosPuestos(filtrosDeTipo('nutriofertas'))).toBe(0)
    expect(filtrosPuestos({ ...filtrosDeTipo('lanzamiento'), marca: 3, sucursal: 1 })).toBe(3)
  })
})

describe('lista del asistente: stock', () => {
  it('envasado: el stock de cada sucursal', () => {
    expect(stockPorSucursal({ tipo: 'entero', stock: { 1: 12, 2: 0, 4: 3.0, 5: -2 } })).toEqual({ 1: 12, 4: 3 })
  })
  it('granel: el suyo más los fraccionados pasados a kilos', () => {
    const s = stockPorSucursal({ tipo: 'granel', stock: { 1: 4.5 }, presentaciones: [{ kg: 1, stock: { 1: 2, 2: 1 } }, { kg: 0.5, stock: { 1: 3 } }, { kg: 0.15, stock: { 2: 10 } }] })
    expect(s).toEqual({ 1: 8, 2: 2.5 })
    expect(stockTotal(s)).toBe(10.5)
  })
  it('lo que no es un número cuenta 0', () => {
    expect(stockPorSucursal({ tipo: 'granel', stock: { 1: 'x' }, presentaciones: [{ kg: 'y', stock: { 1: 5 } }, null] })).toEqual({})
    expect(stockPorSucursal({})).toEqual({})
  })
  it('texto del stock', () => {
    expect(textoStock(48, false)).toBe('48 u.')
    expect(textoStock(6.75, true)).toBe('6,75 kg')
    expect(textoStock(0, false)).toBe('sin stock')
  })
})

describe('lista del asistente: páginas', () => {
  it('pocas: todas', () => {
    expect(paginasVisibles(1, 2)).toEqual([1, 2])
  })
  it('muchas: con puntos suspensivos', () => {
    expect(paginasVisibles(1, 96)).toEqual([1, 2, 3, 4, null, 96])
    expect(paginasVisibles(50, 96)).toEqual([1, null, 49, 50, 51, null, 96])
    expect(paginasVisibles(96, 96)).toEqual([1, null, 93, 94, 95, 96])
  })
})
