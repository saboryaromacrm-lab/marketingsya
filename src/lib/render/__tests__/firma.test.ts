import { describe, expect, it } from 'vitest'
import { firmaDeRuta, firmaValida, rutaCanonica } from '../firma'

const S = 'x'.repeat(64)
describe('firma de rutas de render', () => {
  it('vale para esa ruta y nada más', () => {
    const f = firmaDeRuta('/render/prueba/1', S)
    expect(firmaValida(f, '/render/prueba/1', S)).toBe(true)
    expect(firmaValida(f, '/render/prueba/2', S)).toBe(false)
  })
  it('vence', () => {
    const f = firmaDeRuta('/render/a', S, 60, 0)
    expect(firmaValida(f, '/render/a', S, 59_000)).toBe(true)
    expect(firmaValida(f, '/render/a', S, 61_000)).toBe(false)
  })
  it('no sirve con otro secreto ni mal formada', () => {
    expect(firmaValida(firmaDeRuta('/render/a', S), '/render/a', 'y'.repeat(64))).toBe(false)
    expect(firmaValida('basura', '/render/a', S)).toBe(false)
    expect(firmaValida(null, '/render/a', S)).toBe(false)
  })
  it('una firma de sesión no sirve como firma de render', () => {
    // mismo formato pero otro propósito: el prefijo «render:» las separa
    expect(firmaValida('eyJ2IjoxfQ.abc', '/render/a', S)).toBe(false)
  })
})

describe('rutaCanonica', () => {
  it('firmar y verificar dan lo mismo aunque cambie cómo se escriben las comas', () => {
    const firmado = new URL('http://x/render/prueba/1?productos=1,2,3')
    const ruta = rutaCanonica(firmado.pathname, firmado.searchParams)
    firmado.searchParams.set('firma', firmaDeRuta(ruta, S))
    // Lo que llega al servidor: las comas vienen codificadas como %2C
    const llega = new URL(firmado.toString())
    expect(llega.search).toContain('%2C')
    expect(firmaValida(llega.searchParams.get('firma'), rutaCanonica(llega.pathname, llega.searchParams), S)).toBe(true)
  })
  it('cambiar los productos invalida la firma', () => {
    const u = new URL('http://x/render/prueba/1?productos=1,2,3')
    const f = firmaDeRuta(rutaCanonica(u.pathname, u.searchParams), S)
    const otra = new URL('http://x/render/prueba/1?productos=4,5,6')
    expect(firmaValida(f, rutaCanonica(otra.pathname, otra.searchParams), S)).toBe(false)
  })
})
