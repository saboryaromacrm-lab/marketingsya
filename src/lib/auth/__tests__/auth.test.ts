import { describe, expect, it } from 'vitest'
import { hashearClave, verificarClave } from '../clave'
import { crearToken, tokenValido } from '../sesion'

const SECRETO = 'x'.repeat(64)

describe('contraseña', () => {
  it('acepta la correcta y rechaza otra', async () => {
    const hash = await hashearClave('sabor-y-aroma')
    expect(hash.startsWith('scrypt:')).toBe(true)
    expect(hash).not.toContain('$')
    expect(await verificarClave('sabor-y-aroma', hash)).toBe(true)
    expect(await verificarClave('Sabor-y-aroma', hash)).toBe(false)
  })
  it('dos hashes de la misma contraseña son distintos (sal)', async () => {
    expect(await hashearClave('igual-igual')).not.toBe(await hashearClave('igual-igual'))
  })
  it('un hash mal formado no deja pasar', async () => {
    expect(await verificarClave('lo-que-sea', 'cualquier-cosa')).toBe(false)
    expect(await verificarClave('lo-que-sea', 'scrypt:3:8:1:AAAA:BBBB')).toBe(false)
  })
})

describe('sesión', () => {
  it('un token recién creado es válido', () => {
    expect(tokenValido(crearToken(SECRETO, 30).token, SECRETO)).toBe(true)
  })
  it('vence a los días indicados', () => {
    const ahora = Date.now()
    const { token } = crearToken(SECRETO, 30, ahora)
    expect(tokenValido(token, SECRETO, ahora + 29 * 864e5)).toBe(true)
    expect(tokenValido(token, SECRETO, ahora + 31 * 864e5)).toBe(false)
  })
  it('cambiar el secreto cierra las sesiones', () => {
    expect(tokenValido(crearToken(SECRETO, 30).token, 'y'.repeat(64))).toBe(false)
  })
  it('no se puede alargar el vencimiento a mano', () => {
    const { token } = crearToken(SECRETO, 1)
    const [, firma] = token.split('.')
    const trucho = Buffer.from(JSON.stringify({ v: Date.now() + 1e12 })).toString('base64url')
    expect(tokenValido(`${trucho}.${firma}`, SECRETO)).toBe(false)
  })
  it('sin cookie no hay sesión', () => {
    expect(tokenValido(undefined, SECRETO)).toBe(false)
    expect(tokenValido('basura', SECRETO)).toBe(false)
  })
})
