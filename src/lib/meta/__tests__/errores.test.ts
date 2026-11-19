import { describe, expect, it } from 'vitest'
import { ErrorMeta, errorDeRed, traducirError } from '../errores'

const meta = (code: number, extra: Record<string, unknown> = {}) => ({ error: { message: 'x', code, ...extra } })

describe('errores de Meta', () => {
  it('token vencido: no se reintenta y pide cargar otro', () => {
    const e = traducirError(meta(190), 400)
    expect(e.token).toBe(true)
    expect(e.reintentable).toBe(false)
    expect(e.mensaje).toMatch(/Configuración › Meta/)
  })
  it('límite de pedidos y caídas de Meta: se reintenta', () => {
    expect(traducirError(meta(4), 400).reintentable).toBe(true)
    expect(traducirError(meta(2), 500).reintentable).toBe(true)
    expect(traducirError({ error: { code: 999, is_transient: true } }, 400).reintentable).toBe(true)
    expect(traducirError('<html>', 502).reintentable).toBe(true)
  })
  it('tope de 100 publicaciones por día: no se reintenta', () => {
    const e = traducirError(meta(4, { error_subcode: 2207042 }), 400)
    expect(e.reintentable).toBe(false)
    expect(e.mensaje).toMatch(/100 publicaciones/)
  })
  it('falta de permisos: explica y no reintenta', () => {
    const e = traducirError(meta(10, { message: 'Application does not have permission' }), 403)
    expect(e.reintentable).toBe(false)
    expect(e.mensaje).toMatch(/permiso/)
  })
  it('imagen que Meta no pudo descargar: reintenta y menciona la dirección pública', () => {
    const e = traducirError(meta(9004, { error_subcode: 2207052 }), 400)
    expect(e.reintentable).toBe(true)
    expect(e.mensaje).toMatch(/dirección pública/)
  })
  it('error desconocido: muestra lo que dijo Meta', () => {
    expect(traducirError({ error: { code: 100, error_user_msg: 'Parámetro raro' } }, 400).mensaje).toBe('Meta respondió: «Parámetro raro»')
  })
  it('corte de red justo al publicar: dudoso, nunca se reintenta solo', () => {
    const e = errorDeRed(true)
    expect(e).toBeInstanceOf(ErrorMeta)
    expect(e.dudoso).toBe(true)
    expect(e.reintentable).toBe(false)
    expect(errorDeRed(false).reintentable).toBe(true)
  })
})
