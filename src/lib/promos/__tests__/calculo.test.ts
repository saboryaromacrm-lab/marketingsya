import { describe, expect, it } from 'vitest'
import { aireDePlaca, ALTO, MEDIDAS, nombresCortos, paginar, pesosPromo, precioBase, precioPromo, separarMedida, textoOferta, tituloComun } from '../calculo'
import datos from '../../catalogo/__tests__/datos/catalogo-chico.json'
import { normalizarCatalogo } from '../../catalogo/normalizar'

const cat = normalizarCatalogo(datos)
const prod = (id: number) => cat.productos.find((p) => p.id === id)!

describe('precio promo', () => {
  it('base menos el descuento, con centavos', () => {
    expect(precioPromo(7997, { descuento: 15, cantidadMinima: 6, precioFijo: null })).toBe(6797.45)
    expect(pesosPromo(6797.45)).toBe('$ 6.797,45')
  })
  it('el precio fijo del ERP gana sobre el descuento', () => {
    expect(precioPromo(900, { descuento: 10, cantidadMinima: 3, precioFijo: 766.67 })).toBe(766.67)
  })
  it('sin precio base no hay precio promo', () => {
    expect(precioPromo(null, { descuento: 10, cantidadMinima: null, precioFijo: null })).toBeNull()
  })
  it('granel: el precio del fraccionado elegido o, si no, el de 1 kg', () => {
    expect(precioBase(prod(137), 3)).toBe(8705)
    expect(precioBase(prod(137), 3, '500 g')).toBe(4736)
  })
})

describe('etiqueta de la oferta', () => {
  it('con cantidad mínima, sin cantidad y del ERP', () => {
    expect(textoOferta({ descuento: 15, cantidadMinima: 6, precioFijo: null })).toBe('X6 -15%')
    expect(textoOferta({ descuento: 10, cantidadMinima: null, precioFijo: null })).toBe('-10%')
    expect(textoOferta({ descuento: 10, cantidadMinima: 1, precioFijo: null })).toBe('-10%')
    expect(textoOferta({ descuento: null, cantidadMinima: 3, precioFijo: 766.67 })).toBe('3 × $ 2.300')
  })
})

describe('nombres cortos', () => {
  it('saca lo que se repite y deja la medida aparte', () => {
    expect(nombresCortos(['Pasta de Maní Natural Entrenuts 370 g', 'Pasta de Maní Cacao Entrenuts 370 g', 'Pasta de Maní con Coco Entrenuts 370 g'])).toEqual([
      { nombre: 'Natural', tam: 'x370 g' },
      { nombre: 'Cacao', tam: 'x370 g' },
      { nombre: 'Con Coco', tam: 'x370 g' },
    ])
  })
  it('título común del grupo', () => {
    expect(tituloComun(['Semillas de Chía Cumana 150 g', 'Semillas de Lino Cumana 150 g'])).toBe('Semillas Cumana')
    expect(tituloComun(['Pasta de Maní Natural Entrenuts 370 g', 'Pasta de Maní Cacao Entrenuts 370 g'])).toBe('Pasta de Maní Entrenuts')
  })
  it('separa la medida del nombre', () => {
    expect(separarMedida('Yerba Mate Mañanita 1 kg')).toEqual({ nombre: 'Yerba Mate Mañanita', tam: 'x1 kg' })
    expect(separarMedida('Aji Molido')).toEqual({ nombre: 'Aji Molido', tam: null })
  })
  it('un solo producto queda entero', () => {
    expect(nombresCortos(['Aceite de Coco 360 ml'])).toEqual([{ nombre: 'Aceite de Coco', tam: 'x360 ml' }])
  })
})

describe('paginar', () => {
  const p = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))
  const filaP = { tipo: 'producto' as const, productos: p(1) }
  const grupo = (n: number) => ({ tipo: 'grupo' as const, productos: p(n) })
  const disponible = (f: 'historia' | 'feed') => MEDIDAS[f].alto - ALTO.cabeza['1'] - ALTO.pie - ALTO.margenInferior
  const alto = (pagina: ReturnType<typeof paginar>[number], filas: { tipo: string }[]) =>
    pagina.reduce((a, b, i) => a + (i ? ALTO.separacion : 0) + (filas[b.fila].tipo === 'grupo' ? ALTO.grupoBase + Math.ceil((b.hasta - b.desde) / 4) * ALTO.grupoLinea + (Math.ceil((b.hasta - b.desde) / 4) - 1) * ALTO.grupoEntreLineas : ALTO.fila), 0)

  it('el ejemplo del borrador entra en una historia (3 filas + 2 grupos)', () => {
    const filas = [filaP, filaP, grupo(4), filaP, grupo(4)]
    expect(paginar(filas, 'historia', '1')).toHaveLength(1)
  })
  it('en el feed se parte en varias placas y ninguna se pasa del alto', () => {
    const filas = [filaP, filaP, grupo(4), filaP, grupo(4)]
    const paginas = paginar(filas, 'feed', '1')
    expect(paginas.length).toBeGreaterThan(1)
    for (const pg of paginas) expect(alto(pg, filas)).toBeLessThanOrEqual(disponible('feed'))
    // No se pierde ni se repite ninguna fila
    expect(paginas.flat().map((b) => b.fila)).toEqual([0, 1, 2, 3, 4])
  })
  it('un grupo de 12 productos se parte por líneas y no se pierde ninguno', () => {
    const filas = [grupo(12)]
    const paginas = paginar(filas, 'feed', '1')
    const productos = paginas.flat().reduce((a, b) => a + (b.hasta - b.desde), 0)
    expect(productos).toBe(12)
    for (const pg of paginas) expect(alto(pg, filas)).toBeLessThanOrEqual(disponible('feed'))
  })
  it('sin filas, sin placas', () => {
    expect(paginar([], 'historia', '1')).toEqual([])
  })
})

describe('aireDePlaca', () => {
  it('reparte lo que sobra sin pasarse del espacio disponible', () => {
    for (const formato of ['historia', 'feed'] as const) {
      for (const diseno of ['1', '2'] as const) {
        const disponible = MEDIDAS[formato].alto - ALTO.cabeza[diseno] - ALTO.pie - ALTO.margenInferior
        for (const altos of [[ALTO.fila], [ALTO.fila, ALTO.fila, ALTO.fila], [330, ALTO.fila]]) {
          const a = aireDePlaca(altos, altos[0] === 330, formato, diseno)
          const total = a.arriba + altos.reduce((x, y) => x + y, 0) + a.entre * (altos.length - 1) + (altos[0] === 330 ? ALTO.grupoPrimero : 0)
          expect(total).toBeLessThanOrEqual(disponible + 1)
          expect(a.entre).toBeGreaterThanOrEqual(ALTO.separacion)
          expect(a.entre).toBeLessThanOrEqual(ALTO.separacion + 56)
        }
      }
    }
  })
  it('una placa llena no agrega aire', () => {
    const a = aireDePlaca([ALTO.fila, ALTO.fila, ALTO.fila, ALTO.fila], false, 'feed', '1')
    expect(a.entre).toBe(ALTO.separacion)
  })
})
