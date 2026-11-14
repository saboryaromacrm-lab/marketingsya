import { describe, expect, it } from 'vitest'
import { arreglarCodificacion } from '../codificacion'

describe('arreglarCodificacion', () => {
  it('arregla el caso real del catálogo (cp1252, no latin1)', () => {
    expect(arreglarCodificacion('MAÃ‘ANITA')).toBe('MAÑANITA')
  })
  it('arregla vocales con tilde', () => {
    expect(arreglarCodificacion('AzÃºcar OrgÃ¡nico')).toBe('Azúcar Orgánico')
    expect(arreglarCodificacion('CafÃ© con LimÃ³n')).toBe('Café con Limón')
  })
  it('no toca textos que ya están bien', () => {
    for (const t of ['MAÑANITA', 'Yerba Mate Mañanita x1kg', 'Aceitunas Negras Nº 0', 'Té · Infusión', '']) {
      expect(arreglarCodificacion(t)).toBe(t)
    }
  })
  it('arregla aunque el resto del texto tenga eñes correctas', () => {
    expect(arreglarCodificacion('Señor MAÃ‘ANITA')).toBe('Señor MAÑANITA')
  })
})
