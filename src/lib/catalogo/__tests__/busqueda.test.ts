import { describe, expect, it } from 'vitest'
import datos from './datos/catalogo-chico.json'
import { normalizarCatalogo } from '../normalizar'
import { normalizarTexto, palabrasDeBusqueda, textoDeBusqueda } from '../busqueda'

const cat = normalizarCatalogo(datos)
const prod = (id: number) => cat.productos.find((p) => p.id === id)!

describe('búsqueda', () => {
  it('saca tildes, eñes y mayúsculas', () => {
    expect(normalizarTexto('Yerba MAÑANITA Orgánica')).toBe('yerba mananita organica')
  })
  it('el texto incluye nombre, marca, categoría, etiquetas y códigos', () => {
    const p = prod(1976)
    const t = textoDeBusqueda(p, 'MAÑANITA')
    expect(t.startsWith('yerba mate mananita')).toBe(true)
    for (const w of normalizarTexto(p.categoria!).split(' ')) expect(t.split(' ')).toContain(w)
    if (p.codigoBarras) expect(t).toContain(p.codigoBarras)
  })
  it('incluye los códigos de barras de los fraccionados del granel', () => {
    const p = prod(137)
    expect(textoDeBusqueda(p, null)).toContain(p.presentaciones[0].codigoBarras)
    expect(textoDeBusqueda(p, null)).toContain('granel')
  })
  it('no repite palabras', () => {
    const t = textoDeBusqueda(prod(2410), 'OLIOVITA').split(' ')
    expect(new Set(t).size).toBe(t.length)
  })
  it('separa lo que escribe Lucas en palabras limpias', () => {
    expect(palabrasDeBusqueda('  Aceite,  de OLIVA. ')).toEqual(['aceite', 'de', 'oliva'])
    expect(palabrasDeBusqueda('')).toEqual([])
    expect(palabrasDeBusqueda('a b c d e f g h i j')).toHaveLength(8)
  })
})
