import { describe, expect, it } from 'vitest'
import { leerFiltros, urlConFiltros } from '../filtros'

describe('leerFiltros', () => {
  it('sin parámetros: todo, ordenado por nombre, minorista, página 1', () => {
    expect(leerFiltros({})).toMatchObject({ q: '', pestana: 'todos', orden: 'nombre', lista: 3, pagina: 1, marca: null, foto: null, sinPrecio: false })
  })
  it('con búsqueda, el orden por defecto es por relevancia', () => {
    expect(leerFiltros({ q: 'aceite' }).orden).toBe('relevancia')
    expect(leerFiltros({ q: 'aceite', orden: 'precio-asc' }).orden).toBe('precio-asc')
  })
  it('sin búsqueda no se puede ordenar por relevancia', () => {
    expect(leerFiltros({ orden: 'relevancia' }).orden).toBe('nombre')
  })
  it('ignora valores inválidos en lugar de romperse', () => {
    const f = leerFiltros({ pestana: 'cualquiera', marca: 'abc', foto: 'tal vez', lista: '-1', pagina: '0', orden: 'x' })
    expect(f).toMatchObject({ pestana: 'todos', marca: null, foto: null, lista: 3, pagina: 1, orden: 'nombre' })
  })
  it('acepta «sin marca» para los productos a granel', () => {
    expect(leerFiltros({ marca: 'sin' }).marca).toBe('sin')
  })
  it('la subcategoría sin categoría se descarta', () => {
    expect(leerFiltros({ subcategoria: 'Granolas' }).subcategoria).toBeNull()
  })
  it('si un parámetro viene repetido, toma el primero', () => {
    expect(leerFiltros({ q: ['uno', 'dos'] }).q).toBe('uno')
  })
})

describe('urlConFiltros', () => {
  it('sin filtros da la dirección pelada', () => {
    expect(urlConFiltros(leerFiltros({}))).toBe('/catalogo')
  })
  it('ida y vuelta: lo que se escribe se vuelve a leer igual', () => {
    const f = leerFiltros({ q: 'yerba', marca: '12', etiqueta: 'SIN TACC', foto: 'sin', piezas: 'no', lista: '1', orden: 'precio-desc', pagina: '3', pestana: 'granel' })
    expect(leerFiltros(Object.fromEntries(new URL(urlConFiltros(f, { pagina: 3 }), 'http://x').searchParams))).toEqual(f)
  })
  it('cambiar un filtro vuelve a la página 1', () => {
    const f = leerFiltros({ pagina: '4' })
    expect(urlConFiltros(f, { foto: 'con' })).toBe('/catalogo?foto=con')
    expect(urlConFiltros(f, { pagina: 5 })).toBe('/catalogo?pagina=5')
  })
})
