import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { FotoInvalida, procesarFoto } from '../fotos'

const imagen = (ancho: number, alto: number, formato: 'png' | 'jpeg' | 'webp' = 'jpeg', alfa = false) =>
  sharp({ create: { width: ancho, height: alto, channels: alfa ? 4 : 3, background: alfa ? { r: 200, g: 30, b: 30, alpha: 0 } : { r: 200, g: 30, b: 30 } } })
    .toFormat(formato)
    .toBuffer()

describe('procesarFoto', () => {
  it('saca una versión cuadrada de 1200×1200 y una original de hasta 1600 px', async () => {
    const r = await procesarFoto(await imagen(3000, 2000))
    expect(await sharp(r.cuadrada).metadata()).toMatchObject({ width: 1200, height: 1200, format: 'webp' })
    expect(await sharp(r.original).metadata()).toMatchObject({ width: 1600, height: 1067, format: 'webp' })
  })
  it('una foto apaisada queda con franjas blancas arriba y abajo en la cuadrada', async () => {
    const r = await procesarFoto(await imagen(1200, 600))
    const { data } = await sharp(r.cuadrada).raw().toBuffer({ resolveWithObject: true })
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]) // esquina de arriba: blanco
    const centro = (600 * 1200 + 600) * 3
    expect(data[centro]).toBeGreaterThan(150) // centro: la foto (rojo)
    expect(data[centro + 1]).toBeLessThan(80)
  })
  it('lo transparente de un PNG queda blanco', async () => {
    const r = await procesarFoto(await imagen(800, 800, 'png', true))
    const { data } = await sharp(r.cuadrada).raw().toBuffer({ resolveWithObject: true })
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255])
  })
  it('no agranda fotos chicas en la original', async () => {
    const r = await procesarFoto(await imagen(500, 400))
    expect(await sharp(r.original).metadata()).toMatchObject({ width: 500, height: 400 })
  })
  it('respeta la orientación que guardó el celular', async () => {
    const girada = await sharp(await imagen(1000, 500)).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const r = await procesarFoto(girada)
    expect(r.ancho).toBe(500)
    expect(r.alto).toBe(1000)
    expect(await sharp(r.original).metadata()).toMatchObject({ width: 500, height: 1000 })
  })
  it('rechaza con mensaje claro lo que no sirve', async () => {
    await expect(procesarFoto(Buffer.alloc(0))).rejects.toThrow(FotoInvalida)
    await expect(procesarFoto(Buffer.from('no soy una foto'))).rejects.toThrow(/No es una imagen/)
    await expect(procesarFoto(await imagen(200, 150))).rejects.toThrow(/muy chica/)
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(100)])
    await expect(procesarFoto(heic)).rejects.toThrow(/HEIC/)
    await expect(procesarFoto(Buffer.alloc(21 * 1024 * 1024))).rejects.toThrow(/20 MB/)
  })
})
