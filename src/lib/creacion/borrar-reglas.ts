import type { EstadoExportacion, EstadoPauta, EstadoPublicacion } from '@/lib/db/esquema'

// Reglas para borrar una pieza (carrusel, promo o video propio). Sin base de datos: se prueban solas.

export type TipoPieza = 'carrusel' | 'promo' | 'video'
export type Bloqueo = { motivo: string; enlace: string | null }

/** Publicaciones que todavía pueden salir: la pieza no se borra hasta cancelarlas. */
export const PUBLICACION_PENDIENTE: readonly EstadoPublicacion[] = ['programada', 'publicando', 'reintentando']
/** Pautas que todavía pueden gastar o estar en Meta: la pieza no se borra mientras sigan. */
export const PAUTA_ACTIVA: readonly EstadoPauta[] = ['creando', 'en_revision', 'programada', 'activa', 'pausada', 'con_problemas']
/** Exportaciones que todavía están escribiendo archivos. */
export const EXPORTANDO: readonly EstadoExportacion[] = ['en_cola', 'corriendo']

export const NOMBRE_TIPO: Record<TipoPieza, string> = { carrusel: 'carrusel', promo: 'promo', video: 'video propio' }

/**
 * Por qué no se puede borrar (o null si se puede). Lo publicado sí se borra: en Instagram y Facebook queda,
 * y en Publicaciones el registro sigue como «pieza borrada».
 */
export function bloqueoParaBorrar(s: { publicaciones: EstadoPublicacion[]; pautas: EstadoPauta[]; exportaciones: EstadoExportacion[] }): Bloqueo | null {
  const pendientes = s.publicaciones.filter((e) => PUBLICACION_PENDIENTE.includes(e)).length
  if (pendientes)
    return { motivo: `Tiene ${pendientes === 1 ? 'una publicación programada' : `${pendientes} publicaciones programadas`}: cancelala primero en Publicaciones.`, enlace: '/publicaciones' }
  if (s.pautas.some((e) => PAUTA_ACTIVA.includes(e))) return { motivo: 'Tiene una pauta activa en Meta: terminala primero en Pautas.', enlace: '/pautas' }
  if (s.exportaciones.some((e) => EXPORTANDO.includes(e))) return { motivo: 'Se está exportando en este momento: esperá a que termine.', enlace: null }
  return null
}

/** Los archivos de sus exportaciones (imágenes, videos y el .zip), sin repetir. */
export function archivosDe(exps: { archivos: string[]; zip: string | null }[]): string[] {
  return [...new Set(exps.flatMap((e) => [...e.archivos, ...(e.zip ? [e.zip] : [])]))]
}
