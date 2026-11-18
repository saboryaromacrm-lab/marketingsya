import { describe, expect, it } from 'vitest'
import { estadoPromo, hoyFormosa, sumarDias, textoVigencia } from '../fechas'

describe('fechas de promos', () => {
  it('texto de vigencia como en el flyer', () => {
    expect(textoVigencia('2026-11-18', '2026-11-30')).toBe('DEL 18/11 AL 30/11')
    expect(textoVigencia('2026-12-28', '2027-01-05')).toBe('DEL 28/12/26 AL 05/01/27')
    expect(textoVigencia('2026-11-18', '2026-11-18')).toBe('SOLO EL 18/11')
  })
  it('estado según el día', () => {
    expect(estadoPromo('2026-11-18', '2026-11-30', '2026-11-17')).toBe('por-empezar')
    expect(estadoPromo('2026-11-18', '2026-11-30', '2026-11-18')).toBe('vigente')
    expect(estadoPromo('2026-11-18', '2026-11-30', '2026-11-30')).toBe('vigente')
    expect(estadoPromo('2026-11-18', '2026-11-30', '2026-12-01')).toBe('vencida')
  })
  it('el día es el de Formosa (UTC−3), no el de Londres', () => {
    // 01:30 UTC del 19/11 todavía es 18/11 a las 22:30 en Formosa
    expect(hoyFormosa(new Date('2026-11-19T01:30:00Z'))).toBe('2026-11-18')
  })
  it('sumar días cruzando mes y año', () => {
    expect(sumarDias('2026-11-28', 7)).toBe('2026-12-05')
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02')
  })
})
