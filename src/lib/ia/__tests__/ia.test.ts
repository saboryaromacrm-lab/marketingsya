import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { estacion, fechasDelAnio, pascua, proximasFechas } from '../fechas-especiales'
import { costo, costoEstimado } from '../precios'
import { qrSvg, reedSolomon } from '../../piezas/qr'
import { CONFIG_INICIAL, limpiarConfig, partirWeb } from '../../configuracion-tipos'

describe('fechas especiales', () => {
  it('Pascua y fechas móviles', () => {
    expect(pascua(2026)).toBe('2026-04-05')
    expect(pascua(2027)).toBe('2027-03-28')
    const f = fechasDelAnio(2026)
    expect(f.find((x) => x.nombre === 'Día de la Madre')?.fecha).toBe('2026-10-18')
    expect(f.find((x) => x.nombre === 'Día del Padre')?.fecha).toBe('2026-06-21')
    expect(f.find((x) => x.nombre === 'Día del Niño')?.fecha).toBe('2026-08-16')
  })
  it('próximas fechas cruzan el año', () => {
    expect(proximasFechas('2026-12-20', 20).map((x) => x.nombre)).toEqual(['Nochebuena y Navidad', 'Fin de año', 'Año Nuevo', 'Día de Reyes'])
    expect(estacion('2026-11-19')).toBe('primavera')
    expect(estacion('2027-01-10')).toBe('verano')
  })
})

describe('precios de la IA', () => {
  it('costo con entrada, salida y caché', () => {
    expect(costo('claude-opus-5-5', { entrada: 1_000_000, salida: 0, cacheLectura: 0, cacheEscritura: 0 })).toBe(4)
    expect(costo('claude-opus-5-5', { entrada: 0, salida: 1_000_000, cacheLectura: 1_000_000, cacheEscritura: 0 })).toBeCloseTo(20.2)
    expect(costoEstimado('claude-opus-5-5', 'texto')).toBeLessThan(0.05)
    expect(costoEstimado('claude-haiku-5-5', 'semana')).toBeLessThan(costoEstimado('claude-opus-5-5', 'semana'))
  })
})

describe('QR generado en la plataforma', () => {
  it('Reed-Solomon con el ejemplo conocido', () => {
    expect(reedSolomon([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23])
  })
  it('es idéntico al QR que Lucas escaneó con el celular', () => {
    const probado = readFileSync('public/piezas/qr-tienda.svg', 'utf8')
    expect(qrSvg('https://tiendaonline.saboryaroma.com')).toBe(probado)
  })
})

describe('configuración', () => {
  it('mezcla con los valores de entrada y corrige tipos y rangos', () => {
    const c = limpiarConfig({ contacto: { web: 'https://otra.tienda.com/', instagram: 'cuenta' }, ia: { topeTotal: 10, topeTexto: 50, hashtags: ['vida sana', '#Formosa', '#Formosa'], modelo: 'gpt' }, piezas: { descuento: 200 } })
    expect(c.contacto.web).toBe('otra.tienda.com')
    expect(c.contacto.instagram).toBe('@cuenta')
    expect(c.contacto.whatsapp).toBe(CONFIG_INICIAL.contacto.whatsapp)
    expect(c.ia.topeTexto).toBe(10)
    expect(c.ia.hashtags).toEqual(['#vidasana', '#Formosa'])
    expect(c.ia.modelo).toBe('claude-opus-5-5')
    expect(c.piezas.descuento).toBe(90)
  })
  it('parte la web para resaltar la marca', () => {
    expect(partirWeb('tiendaonline.saboryaroma.com')).toEqual(['tiendaonline.', 'saboryaroma', '.com'])
    expect(partirWeb('saboryaroma.com.ar')).toEqual(['', 'saboryaroma', '.com.ar'])
    expect(partirWeb('www.tienda.saboryaroma.com')).toEqual(['www.tienda.', 'saboryaroma', '.com'])
  })
})
