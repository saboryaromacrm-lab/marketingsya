// Reglas de las publicaciones. Puras (sin base ni red): las usan el servidor y la pantalla, y se prueban solas.

import type { EstadoDestino, EstadoPublicacion, RedSocial, UbicacionDestino } from '@/lib/db/esquema'

export const MAX_TEXTO = 2200
export const MAX_HASHTAGS = 30
export const MAX_MENCIONES = 20
export const MAX_IMAGENES_FEED = 10
export const MAX_ALT = 1000
// Lo más lejos que se puede programar
export const MAX_DIAS_PROGRAMAR = 75

// Formosa está en UTC−3 todo el año (Argentina no usa horario de verano)
const OFFSET = '-03:00'
const ZONA = 'America/Argentina/Cordoba'

/** Fecha (AAAA-MM-DD) y hora (HH:MM) de Formosa → instante. null si no es válida. */
export function aInstante(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null
  const d = new Date(`${fecha}T${hora}:00${OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Instante → fecha y hora de Formosa. */
export function partesFormosa(d: Date): { fecha: string; hora: string } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const v = (t: string) => f.find((x) => x.type === t)?.value ?? '00'
  return { fecha: `${v('year')}-${v('month')}-${v('day')}`, hora: `${v('hour')}:${v('minute')}` }
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «hoy a las 19:00», «mañana a las 10:00», «el jueves 21/11 a las 10:00». */
export function textoCuando(d: Date, ahora = new Date()): string {
  const { fecha, hora } = partesFormosa(d)
  const hoy = partesFormosa(ahora).fecha
  const manana = partesFormosa(new Date(ahora.getTime() + 864e5)).fecha
  if (fecha === hoy) return `hoy a las ${hora}`
  if (fecha === manana) return `mañana a las ${hora}`
  const dia = DIAS_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()]
  return `el ${dia} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} a las ${hora}`
}

/** Cuenta como Instagram: letras (emojis incluidos, uno por símbolo), hashtags y menciones. */
export function contarTexto(t: string) {
  return {
    letras: [...t].length,
    hashtags: (t.match(/(^|[^\p{L}\p{N}_&])#[\p{L}\p{N}_]+/gu) ?? []).length,
    menciones: (t.match(/(^|[^\p{L}\p{N}_.])@[\p{L}\p{N}_.]+/gu) ?? []).length,
  }
}

/** Lo que impide publicar el texto en el feed (vacío en las historias: no llevan texto). */
export function problemasDelTexto(t: string): string[] {
  const c = contarTexto(t)
  const p: string[] = []
  if (!t.trim()) p.push('Escribí el texto del posteo.')
  if (c.letras > MAX_TEXTO) p.push(`El texto tiene ${c.letras} letras: Instagram acepta hasta ${MAX_TEXTO}.`)
  if (c.hashtags > MAX_HASHTAGS) p.push(`Tiene ${c.hashtags} hashtags: Instagram acepta hasta ${MAX_HASHTAGS}.`)
  if (c.menciones > MAX_MENCIONES) p.push(`Tiene ${c.menciones} menciones: Instagram acepta hasta ${MAX_MENCIONES}.`)
  return p
}

/** Texto alternativo automático: «Carrusel de Sabor y Aroma con pasta de maní natural, almendras y miel». */
export function textoAlternativo(tipo: 'carrusel' | 'promo', titulo: string, nombres: string[]): string {
  const unicos = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))]
  const lista = unicos.length > 1 ? `${unicos.slice(0, -1).join(', ')} y ${unicos[unicos.length - 1]}` : unicos[0] ?? ''
  const inicio = tipo === 'promo' ? `Promociones de Sabor y Aroma (${titulo.trim()})` : `${titulo.trim() || 'Carrusel'} de Sabor y Aroma`
  const t = lista ? `${inicio} con ${lista}.` : `${inicio}.`
  return [...t].length > MAX_ALT ? `${[...t].slice(0, MAX_ALT - 1).join('')}…` : t
}

// ---------------------------------------------------------------------------
// Destinos: qué se publica dónde
// ---------------------------------------------------------------------------
export type Grupo = 'feed' | 'historia'
export type DestinosElegidos = Record<Grupo, { instagram: boolean; facebook: boolean }>
export type FilaDestino = { red: RedSocial; ubicacion: UbicacionDestino; placas: number[] }

/**
 * Arma los destinos: el feed va en un solo posteo por red (carrusel en Instagram, álbum en Facebook);
 * cada historia es una publicación aparte (así un reintento nunca repite una que ya salió).
 * Primero Instagram, después Facebook.
 */
export function planDestinos(placas: { indice: number; grupo: Grupo }[], elegidas: number[], destinos: DestinosElegidos): FilaDestino[] {
  const si = new Set(elegidas)
  const feed = placas.filter((p) => p.grupo === 'feed' && si.has(p.indice)).map((p) => p.indice)
  const historias = placas.filter((p) => p.grupo === 'historia' && si.has(p.indice)).map((p) => p.indice)
  const filas: FilaDestino[] = []
  for (const red of ['instagram', 'facebook'] as const) {
    if (feed.length && destinos.feed[red]) filas.push({ red, ubicacion: 'feed', placas: feed })
    if (destinos.historia[red]) for (const h of historias) filas.push({ red, ubicacion: 'historia', placas: [h] })
  }
  return filas
}

/** Lo que impide aprobar la publicación (además del texto). */
export function problemasDePlan(placas: { indice: number; grupo: Grupo }[], elegidas: number[], destinos: DestinosElegidos): string[] {
  const si = new Set(elegidas)
  const feed = placas.filter((p) => p.grupo === 'feed' && si.has(p.indice)).length
  const historias = placas.filter((p) => p.grupo === 'historia' && si.has(p.indice)).length
  const p: string[] = []
  const feedActivo = feed > 0 && (destinos.feed.instagram || destinos.feed.facebook)
  const historiaActiva = historias > 0 && (destinos.historia.instagram || destinos.historia.facebook)
  if (!feedActivo && !historiaActiva) p.push('Elegí al menos una imagen y dónde publicarla.')
  if (feed > MAX_IMAGENES_FEED && destinos.feed.instagram) p.push(`Instagram acepta hasta ${MAX_IMAGENES_FEED} imágenes por posteo: sacá ${feed - MAX_IMAGENES_FEED}.`)
  return p
}

/** Hay feed elegido (y por lo tanto el texto hace falta). */
export function llevaTexto(placas: { indice: number; grupo: Grupo }[], elegidas: number[], destinos: DestinosElegidos): boolean {
  const si = new Set(elegidas)
  return placas.some((p) => p.grupo === 'feed' && si.has(p.indice)) && (destinos.feed.instagram || destinos.feed.facebook)
}

// ---------------------------------------------------------------------------
// Estado general a partir de los destinos
// ---------------------------------------------------------------------------
export function estadoGeneral(estados: EstadoDestino[]): EstadoPublicacion {
  if (!estados.length) return 'error'
  if (estados.every((e) => e === 'cancelado')) return 'cancelada'
  const vivos = estados.filter((e) => e !== 'cancelado')
  if (vivos.some((e) => e === 'pendiente' || e === 'publicando')) return 'reintentando'
  if (vivos.every((e) => e === 'ok')) return 'publicada'
  if (vivos.every((e) => e === 'error')) return 'error'
  return 'parcial'
}

export const ETIQUETA_ESTADO: Record<EstadoPublicacion, { texto: string; clase: string }> = {
  programada: { texto: 'PROGRAMADA', clase: 'chip-en_cola' },
  publicando: { texto: 'PUBLICANDO', clase: 'chip-en_cola' },
  reintentando: { texto: 'REINTENTANDO', clase: 'chip-en_cola' },
  publicada: { texto: 'PUBLICADA', clase: 'chip-ok' },
  parcial: { texto: 'SALIÓ EN PARTE', clase: 'chip-error' },
  error: { texto: 'FALLÓ', clase: 'chip-error' },
  cancelada: { texto: 'CANCELADA', clase: '' },
}

export const NOMBRE_DESTINO = (red: RedSocial, ubicacion: UbicacionDestino) => `${red === 'instagram' ? 'Instagram' : 'Facebook'} · ${ubicacion === 'feed' ? (red === 'instagram' ? 'feed' : 'página') : ubicacion === 'reel' ? 'reel' : 'historia'}`

// ---------------------------------------------------------------------------
// Videos: un solo archivo por publicación
// ---------------------------------------------------------------------------
export type QuePublicar = 'imagenes' | 'reel' | 'historiaVideo' | 'videoFeed'
export type RedesElegidas = { instagram: boolean; facebook: boolean }

/** Reel → reels de Instagram y de Facebook; historia en video → historias; video de feed → reel en el feed de Instagram y video en la página. */
export function planDestinosVideo(que: Exclude<QuePublicar, 'imagenes'>, redes: RedesElegidas): FilaDestino[] {
  const filas: FilaDestino[] = []
  if (redes.instagram) filas.push({ red: 'instagram', ubicacion: que === 'historiaVideo' ? 'historia' : 'reel', placas: [0] })
  if (redes.facebook) filas.push({ red: 'facebook', ubicacion: que === 'historiaVideo' ? 'historia' : que === 'reel' ? 'reel' : 'feed', placas: [0] })
  return filas
}

export const NOMBRE_QUE: Record<QuePublicar, string> = { imagenes: 'Carrusel e historias', reel: 'Reel', historiaVideo: 'Historia en video', videoFeed: 'Video de feed' }
