import { describe, expect, it } from 'vitest'
import { Limitador } from '@/lib/limitador'

function relojFalso() {
  let t = 0
  return { ahora: () => t, esperar: async (ms: number) => { t += ms } }
}

describe('Limitador', () => {
  it('espacia los pedidos según el intervalo', async () => {
    const r = relojFalso()
    const l = new Limitador(125, r.ahora, r.esperar)
    const momentos: number[] = []
    for (let i = 0; i < 4; i++) {
      await l.turno()
      momentos.push(r.ahora())
    }
    expect(momentos).toEqual([0, 125, 250, 375])
  })
  it('después de un 429 nadie pide nada hasta que pase la pausa', async () => {
    const r = relojFalso()
    const l = new Limitador(125, r.ahora, r.esperar)
    await l.turno()
    l.pausar(20)
    await l.turno()
    expect(r.ahora()).toBe(20_000)
  })
})
