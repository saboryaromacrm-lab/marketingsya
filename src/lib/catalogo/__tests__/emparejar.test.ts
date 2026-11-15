import { describe, expect, it } from 'vitest'
import { armarIndice, claveDelArchivo, emparejar } from '../emparejar'

const indice = armarIndice([
  { id: 1976, codigo: 'ARC006', codigosBarras: ['7790387015317'] },
  { id: 137, codigo: '', codigosBarras: ['6850000000111', '64489965522'] },
  { id: 500, codigo: '1976', codigosBarras: [] }, // su código coincide con el ID de otro
  { id: 600, codigo: 'DUP', codigosBarras: ['111'] },
  { id: 601, codigo: 'DUP', codigosBarras: ['111'] },
])

describe('claveDelArchivo', () => {
  it('saca extensión, copias y mayúsculas', () => {
    expect(claveDelArchivo('7790387015317.jpg')).toBe('7790387015317')
    expect(claveDelArchivo('7790387015317 (1).JPG')).toBe('7790387015317')
    expect(claveDelArchivo('ARC006_2.png')).toBe('arc006')
    expect(claveDelArchivo('carpeta/fotos/137.webp')).toBe('137')
  })
})

describe('emparejar', () => {
  it('por código de barras, por código interno y por ID', () => {
    const r = emparejar(['7790387015317.jpg', 'arc006.png', '137.jpg'], indice)
    expect(r.map((x) => x.estado === 'ok' && [x.productoId, x.por])).toEqual([
      [1976, 'código de barras'],
      false, // arc006 es el mismo producto que el anterior: repetido
      [137, 'ID'],
    ])
    expect(r[1].estado).toBe('repetido')
  })
  it('el código de barras de un fraccionado va al producto a granel', () => {
    expect(emparejar(['64489965522.jpg'], indice)[0]).toMatchObject({ estado: 'ok', productoId: 137 })
  })
  it('si un número es código de un producto e ID de otro, gana el código', () => {
    expect(emparejar(['1976.jpg'], indice)[0]).toMatchObject({ estado: 'ok', productoId: 500, por: 'código' })
  })
  it('avisa cuando dos productos comparten el mismo código', () => {
    expect(emparejar(['111.jpg'], indice)[0]).toMatchObject({ estado: 'ambiguo', candidatos: [600, 601] })
  })
  it('lo que no coincide queda marcado', () => {
    expect(emparejar(['foto de la góndola.jpg', '99999.jpg'], indice).map((x) => x.estado)).toEqual(['sin-coincidencia', 'sin-coincidencia'])
  })
})
