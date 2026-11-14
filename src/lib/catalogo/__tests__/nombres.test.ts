import { describe, expect, it } from 'vitest'
import { nombreSugerido } from '../nombres'

// Casos reales del catálogo.
const casos: [string, string][] = [
  ['PASTA FUSILLI CON CHIA WAKAS X300GRS', 'Pasta Fusilli con Chía Wakas 300 g'],
  ['Aceit Oliva E.v Org Oliovita x250cc', 'Aceite Oliva Extra Virgen Orgánico Oliovita 250 ml'],
  ['Acai en Polvo Oh Yeah x50g', 'Acai en Polvo Oh Yeah 50 g'],
  ['Te de Boldo Oasis x25saq', 'Té de Boldo Oasis 25 saquitos'],
  ['Tint.madre Cardomariano Oasis x60cc', 'Tintura Madre Cardomariano Oasis 60 ml'],
  ['CHIPITAS COFFIT X1UN X40GRS', 'Chipitas Coffit 40 g'],
  ['Yerba Mate Mañanita x1kg', 'Yerba Mate Mañanita 1 kg'],
  ['ACEITE DE OLIVA E.V OLIV DE COSTA PETX1L', 'Aceite de Oliva Extra Virgen Oliv de Costa 1 L'],
  ['Acai Original Maracaibo x3 5kg Balde', 'Acai Original Maracaibo 3,5 kg'],
  ['Alfajor Blanco con Ddl Doninas x40grs', 'Alfajor Blanco con Dulce de Leche Doninas 40 g'],
  ['Arandanos Ury Extractos Vitaminway x30caps', 'Arándanos Ury Extractos Vitaminway 30 cápsulas'],
  ['Tapas Empanadas sin TACC Argenti x12und', 'Tapas Empanadas sin TACC Argenti 12 u.'],
  ['Cafe Puro Aroma la Virginia x20saq', 'Café Puro Aroma la Virginia 20 saquitos'],
  ['Aji Molido', 'Aji Molido'],
  ['Chipitas Clasicos Ya Chipacitos x10k a Granel', 'Chipitas Clásicos Ya Chipacitos 10 kg'],
  ['Almendras CUMANA DOYP x120g', 'Almendras Cumana 120 g'],
  ['ALFAJOR RELLENO DDL S/A HARTO X70GRS', 'Alfajor Relleno Dulce de Leche sin Azúcar Harto 70 g'],
  ['Galletitas crackers sin sal mauri x400grs', 'Galletitas Crackers sin Sal Mauri 400 g'],
  ['Fideos Integral con Zanahoria Lilen x500 Caja', 'Fideos Integral con Zanahoria Lilen x500'],
]

describe('nombreSugerido', () => {
  it.each(casos)('%s', (erp, esperado) => {
    expect(nombreSugerido(erp)).toBe(esperado)
  })
  it('no rompe nombres raros', () => {
    for (const t of ['', '   ', 'x', 'X1', 'A']) expect(() => nombreSugerido(t)).not.toThrow()
  })
})
