import { describe, expect, it } from 'vitest'
import { esPinValido } from '../pin'

describe('esPinValido', () => {
  it('acepta de 4 a 8 números', () => {
    for (const p of ['1234', '0000', '12345678']) expect(esPinValido(p)).toBe(true)
  })
  it('rechaza cortos, largos, letras y espacios', () => {
    for (const p of ['', '123', '123456789', '12a4', ' 1234', '12 34', '١٢٣٤']) expect(esPinValido(p)).toBe(false)
  })
})
