import { describe, expect, it } from 'vitest'
import { archivosDe, bloqueoParaBorrar } from '../borrar-reglas'

describe('borrar una pieza', () => {
  const nada = { publicaciones: [], pautas: [], exportaciones: [] }

  it('sin nada pendiente se borra (también si ya se publicó o falló)', () => {
    expect(bloqueoParaBorrar(nada)).toBeNull()
    expect(bloqueoParaBorrar({ ...nada, publicaciones: ['publicada', 'parcial', 'error', 'cancelada'], exportaciones: ['ok', 'error'] })).toBeNull()
    expect(bloqueoParaBorrar({ ...nada, pautas: ['terminada', 'rechazada', 'error'] })).toBeNull()
  })

  it('con una publicación programada (o saliendo) no se borra y dice dónde cancelarla', () => {
    expect(bloqueoParaBorrar({ ...nada, publicaciones: ['publicada', 'programada'] })).toEqual({ motivo: 'Tiene una publicación programada: cancelala primero en Publicaciones.', enlace: '/publicaciones' })
    expect(bloqueoParaBorrar({ ...nada, publicaciones: ['reintentando', 'publicando'] })?.motivo).toBe('Tiene 2 publicaciones programadas: cancelala primero en Publicaciones.')
  })

  it('con una pauta que todavía está en Meta no se borra', () => {
    for (const e of ['creando', 'en_revision', 'programada', 'activa', 'pausada', 'con_problemas'] as const)
      expect(bloqueoParaBorrar({ ...nada, publicaciones: ['publicada'], pautas: [e] })?.enlace).toBe('/pautas')
  })

  it('mientras se exporta no se borra (los archivos se están escribiendo)', () => {
    expect(bloqueoParaBorrar({ ...nada, exportaciones: ['ok', 'corriendo'] })).toEqual({ motivo: 'Se está exportando en este momento: esperá a que termine.', enlace: null })
    expect(bloqueoParaBorrar({ ...nada, exportaciones: ['en_cola'] })).not.toBeNull()
  })

  it('los archivos de sus exportaciones, con el .zip y sin repetir (el reel y la historia comparten el MP4)', () => {
    expect(archivosDe([
      { archivos: ['exportaciones/1/placa-1.jpg', 'exportaciones/1/placa-2.jpg'], zip: 'exportaciones/1/carrusel.zip' },
      { archivos: ['videos/7/reel.mp4', 'videos/7/portada.jpg'], zip: 'videos/7/reel.mp4' },
      { archivos: ['videos/7/reel.mp4', 'videos/7/portada.jpg'], zip: 'videos/7/reel.mp4' },
    ])).toEqual(['exportaciones/1/placa-1.jpg', 'exportaciones/1/placa-2.jpg', 'exportaciones/1/carrusel.zip', 'videos/7/reel.mp4', 'videos/7/portada.jpg'])
  })
})
