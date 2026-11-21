// Reglas de los videos (reels, historias en video y videos de feed). Puras: se prueban sin navegador.

import type { AnimacionPieza, FormatosCarrusel } from '@/lib/db/esquema'

export const FORMATOS_VIDEO = {
  reel: { nombre: 'Reel', ancho: 1080, alto: 1920, duracion: 15, detalle: 'Video animado 9:16' },
  historiaVideo: { nombre: 'Historia en video', ancho: 1080, alto: 1920, duracion: 8, detalle: 'Animada 9:16' },
  videoFeed: { nombre: 'Video de feed', ancho: 1080, alto: 1350, duracion: 15, detalle: 'Animado 4:5' },
} as const
export type FormatoVideo = keyof typeof FORMATOS_VIDEO
export const esFormatoVideo = (x: unknown): x is FormatoVideo => typeof x === 'string' && x in FORMATOS_VIDEO

export const DURACIONES = [8, 15, 20, 30] as const
export const FPS = 30

export const ANIMACION_INICIAL: AnimacionPieza = { duracion: 15, ritmo: 'suave', variante: 'auto', musicaId: null, portada: 0.8 }
export const FORMATOS_CARRUSEL_INICIAL: FormatosCarrusel = { carrusel: true, historia: false, reel: false, historiaVideo: false, videoFeed: false }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function limpiarAnimacion(v: unknown, base: AnimacionPieza = ANIMACION_INICIAL): AnimacionPieza {
  const a = obj(v)
  const duracion = DURACIONES.includes(Number(a.duracion) as (typeof DURACIONES)[number]) ? Number(a.duracion) : base.duracion
  return {
    duracion,
    ritmo: a.ritmo === 'dinamico' || a.ritmo === 'suave' ? a.ritmo : base.ritmo,
    variante: a.variante === '1' || a.variante === '2' || a.variante === '3' || a.variante === 'auto' ? a.variante : base.variante,
    musicaId: Number.isInteger(a.musicaId) && Number(a.musicaId) > 0 ? Number(a.musicaId) : a.musicaId === null ? null : base.musicaId,
    portada: (() => {
      const n = typeof a.portada === 'string' ? Number(a.portada.replace(',', '.')) : typeof a.portada === 'number' ? a.portada : NaN
      return Number.isFinite(n) ? Math.min(60, Math.max(0, Math.round(n * 10) / 10)) : base.portada
    })(),
  }
}

export function limpiarFormatosCarrusel(v: unknown, base: FormatosCarrusel = FORMATOS_CARRUSEL_INICIAL): FormatosCarrusel {
  const f = obj(v)
  const b = (k: keyof FormatosCarrusel) => (typeof f[k] === 'boolean' ? (f[k] as boolean) : base[k])
  return { carrusel: b('carrusel'), historia: b('historia'), reel: b('reel'), historiaVideo: b('historiaVideo'), videoFeed: b('videoFeed') }
}

/** Formatos de video encendidos (en el orden de siempre). */
export const videosDe = (f: Partial<Record<FormatoVideo, boolean | undefined>>): FormatoVideo[] => (Object.keys(FORMATOS_VIDEO) as FormatoVideo[]).filter((k) => !!f[k])

// ---------------------------------------------------------------------------
// Tiempos: cuánto dura cada escena. Si no entra en la duración elegida, las escenas del medio se acortan
// (hasta un mínimo) y, si aun así no entra, se dejan afuera los últimos productos (con aviso).
// ---------------------------------------------------------------------------
export type TipoEscena = 'portada' | 'producto' | 'lista' | 'pasos' | 'cierre'
export type EscenaTiempo = { tipo: TipoEscena; items?: number }

const BASE: Record<TipoEscena, (n: number) => number> = {
  portada: () => 2.4,
  producto: () => 3.3,
  lista: (n) => Math.max(3, 1.1 + 0.5 * n),
  pasos: (n) => Math.max(3.2, 1.2 + 0.85 * n),
  cierre: () => 2.8,
}
const MINIMO: Record<TipoEscena, number> = { portada: 1.6, producto: 2, lista: 2.6, pasos: 2.8, cierre: 2.2 }

export const factorRitmo = (ritmo: AnimacionPieza['ritmo']) => (ritmo === 'dinamico' ? 0.75 : 1)

/** Duración de cada escena que entra, y qué escenas entran (por su posición en la lista original). */
export function planTiempos(escenas: EscenaTiempo[], maximo: number, ritmo: AnimacionPieza['ritmo']): { duraciones: number[]; indices: number[]; total: number; omitidas: number } {
  const f = factorRitmo(ritmo)
  const esMedio = (e: EscenaTiempo) => e.tipo !== 'portada' && e.tipo !== 'cierre'
  let lista = escenas.map((e, i) => ({ e, i }))
  const medir = (xs: EscenaTiempo[], escala: number) => xs.map((e) => Math.max(MINIMO[e.tipo] * f, BASE[e.tipo](e.items ?? 1) * f * (esMedio(e) ? escala : 1)))
  for (;;) {
    const fijos = lista.filter((x) => !esMedio(x.e)).map((x) => x.e)
    const medios = lista.filter((x) => esMedio(x.e)).map((x) => x.e)
    const tFijo = medir(fijos, 1).reduce((s, x) => s + x, 0)
    const tMedio = medir(medios, 1).reduce((s, x) => s + x, 0)
    const escala = tMedio > 0 ? Math.min(1, Math.max(0, (maximo - tFijo) / tMedio)) : 1
    const duraciones = medir(lista.map((x) => x.e), escala).map((x) => Math.round(x * 100) / 100)
    const total = Math.round(duraciones.reduce((s, x) => s + x, 0) * 100) / 100
    // Si entra (o ya queda un solo producto), listo
    if (total <= maximo + 0.01 || medios.length <= 1) return { duraciones, indices: lista.map((x) => x.i), total, omitidas: escenas.length - lista.length }
    // Se saca el último producto
    const ultimo = lista.filter((x) => esMedio(x.e)).pop()!
    lista = lista.filter((x) => x !== ultimo)
  }
}
