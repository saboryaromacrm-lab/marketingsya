// Reglas de las pautas. Puras (sin base ni red): las usan el servidor y las pantallas, y se prueban solas.

import type { EstadoPauta, ResultadosPauta } from '@/lib/db/esquema'
import { OBJETIVOS_PAUTA, type ObjetivoPauta, type PublicoPauta, type UbicacionesPauta } from '@/lib/configuracion-tipos'

export const MAX_DIAS_PAUTA = 90

// ---------------------------------------------------------------------------
// Fechas y montos
// ---------------------------------------------------------------------------
const esFecha = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))

/** Días entre dos fechas, contando los dos extremos (del 20 al 26 son 7). 0 si están al revés o mal escritas. */
export function diasEntre(desde: string, hasta: string): number {
  if (!esFecha(desde) || !esFecha(hasta)) return 0
  const d = Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 864e5) + 1
  return d > 0 ? d : 0
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lo máximo que puede gastar: por día × días (en pesos enteros). */
export const totalPauta = (porDia: number, dias: number) => Math.round(porDia) * dias

/** Meta pide los montos en la unidad mínima de la moneda: centavos para el peso. */
export const aUnidadMinima = (pesos: number) => Math.round(pesos * 100)
export const deUnidadMinima = (n: number | string | null | undefined) => (n == null || n === '' ? 0 : Number(n) / 100)

export const conImpuestos = (total: number, iva: number) => Math.round(total * (1 + iva / 100))

/** «$ 21.000» (sin centavos: los presupuestos son en pesos enteros). */
export const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`

/** Inicio y fin para Meta, en hora de Formosa (UTC−3): desde las 00:00 (o ahora, si es hoy) hasta las 23:59 del último día. */
export function horarioMeta(desde: string, hasta: string, ahora = new Date(), hoy: string): { inicio: string; fin: string } {
  const inicio = desde <= hoy ? new Date(ahora.getTime() + 60_000).toISOString() : `${desde}T00:00:00-0300`
  return { inicio, fin: `${hasta}T23:59:00-0300` }
}

/** Lo que impide lanzar por las fechas o el monto (el mínimo diario lo informa Meta para la cuenta). */
export function problemasPresupuesto(p: { porDia: number; desde: string; hasta: string; hoy: string; minDiario: number | null }): string[] {
  const r: string[] = []
  if (!esFecha(p.desde) || !esFecha(p.hasta)) return ['Revisá las fechas.']
  if (p.desde < p.hoy) r.push('La fecha de inicio ya pasó.')
  const dias = diasEntre(p.desde, p.hasta)
  if (!dias) r.push('La fecha de fin es anterior a la de inicio.')
  if (dias > MAX_DIAS_PAUTA) r.push(`Una pauta puede durar hasta ${MAX_DIAS_PAUTA} días.`)
  if (!(p.porDia > 0)) r.push('Poné cuánto por día.')
  else if (p.minDiario && p.porDia < p.minDiario) r.push(`Meta pide como mínimo ${pesos(p.minDiario)} por día en tu cuenta.`)
  return r
}

// ---------------------------------------------------------------------------
// Tope del mes
// ---------------------------------------------------------------------------
type PautaTope = { estado: EstadoPauta; total: number; gastado: number; mes: string }

/** Las que todavía pueden gastar: se cuentan por su total; las terminadas, por lo que gastaron de verdad. */
const pendiente = (e: EstadoPauta) => e === 'creando' || e === 'en_revision' || e === 'programada' || e === 'activa' || e === 'pausada' || e === 'con_problemas'

export function comprometidoDelMes(pautas: PautaTope[], mes: string, sinId?: (p: PautaTope) => boolean): number {
  return pautas.filter((p) => p.mes === mes && !sinId?.(p)).reduce((s, p) => s + (pendiente(p.estado) ? Math.max(p.total, p.gastado) : p.gastado), 0)
}

export function gastadoDelMes(pautas: PautaTope[], mes: string): number {
  return pautas.filter((p) => p.mes === mes).reduce((s, p) => s + p.gastado, 0)
}

// ---------------------------------------------------------------------------
// Estado: lo que dice Meta del anuncio → el estado que ve Lucas
// ---------------------------------------------------------------------------
export function estadoDesdeMeta(m: { anuncio: string | null; inicio: string; fin: string; ahora?: Date }): EstadoPauta {
  const ahora = (m.ahora ?? new Date()).getTime()
  const e = (m.anuncio ?? '').toUpperCase()
  if (e === 'DISAPPROVED') return 'rechazada'
  if (e === 'ARCHIVED' || e === 'DELETED') return 'terminada'
  if (Date.parse(m.fin) < ahora) return 'terminada'
  if (e === 'PENDING_REVIEW' || e === 'IN_PROCESS') return 'en_revision'
  if (e === 'WITH_ISSUES' || e === 'PENDING_BILLING_INFO') return 'con_problemas'
  if (e === 'PAUSED' || e === 'CAMPAIGN_PAUSED' || e === 'ADSET_PAUSED') return 'pausada'
  if (e === 'ACTIVE' || e === 'PREAPPROVED') return Date.parse(m.inicio) > ahora ? 'programada' : 'activa'
  return 'en_revision'
}

export const ESTADO_FINAL = (e: EstadoPauta) => e === 'terminada' || e === 'rechazada' || e === 'error'

export const ETIQUETA_PAUTA: Record<EstadoPauta, { texto: string; clase: string }> = {
  creando: { texto: 'CREANDO', clase: 'chip-en_cola' },
  en_revision: { texto: 'EN REVISIÓN', clase: 'chip-en_cola' },
  programada: { texto: 'PROGRAMADA', clase: 'chip-en_cola' },
  activa: { texto: 'ACTIVA', clase: 'chip-ok' },
  pausada: { texto: 'PAUSADA', clase: '' },
  con_problemas: { texto: 'CON PROBLEMAS', clase: 'chip-error' },
  rechazada: { texto: 'RECHAZADA', clase: 'chip-error' },
  terminada: { texto: 'TERMINADA', clase: '' },
  error: { texto: 'NO SE CREÓ', clase: 'chip-error' },
}

// ---------------------------------------------------------------------------
// Resultados (insights de Meta)
// ---------------------------------------------------------------------------
type Accion = { action_type?: string; value?: string | number }
export type Insight = { spend?: string | number; reach?: string | number; impressions?: string | number; inline_link_clicks?: string | number; actions?: Accion[] }

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function resultadosDesdeInsight(i: Insight | null | undefined): { gastado: number; resultados: ResultadosPauta } {
  const accion = (tipo: string) => n((i?.actions ?? []).find((a) => a.action_type === tipo)?.value)
  return {
    gastado: n(i?.spend),
    resultados: {
      alcance: n(i?.reach),
      impresiones: n(i?.impressions),
      clics: n(i?.inline_link_clicks) || accion('link_click'),
      mensajes: accion('onsite_conversion.messaging_conversation_started_7d'),
    },
  }
}

/** «43 mensajes» y «$ 142 c/u», según el objetivo. */
export function resultadoPrincipal(objetivo: ObjetivoPauta, gastado: number, r: ResultadosPauta | null): { texto: string; costo: string | null } | null {
  if (!r) return null
  const cant = objetivo === 'mensajes' ? r.mensajes : objetivo === 'trafico' ? r.clics : r.alcance
  const [uno, varios] = OBJETIVOS_PAUTA[objetivo].resultado
  const texto = `${cant.toLocaleString('es-AR')} ${cant === 1 ? uno : varios}`
  if (!cant || !gastado) return { texto, costo: null }
  const c = gastado / cant
  const costo = objetivo === 'alcance' ? `${pesos(c * 1000)} cada mil` : `${c < 100 ? `$ ${c.toLocaleString('es-AR', { maximumFractionDigits: 2 })}` : pesos(c)} c/u`
  return { texto, costo }
}

// ---------------------------------------------------------------------------
// Lo que se le manda a Meta
// ---------------------------------------------------------------------------
export const META_OBJETIVO: Record<ObjetivoPauta, { objetivo: string; optimizacion: string; destino?: string }> = {
  mensajes: { objetivo: 'OUTCOME_ENGAGEMENT', optimizacion: 'CONVERSATIONS', destino: 'WHATSAPP' },
  trafico: { objetivo: 'OUTCOME_TRAFFIC', optimizacion: 'LINK_CLICKS', destino: 'WEBSITE' },
  alcance: { objetivo: 'OUTCOME_AWARENESS', optimizacion: 'REACH' },
}

/** Enlace a la tienda con la marca de seguimiento («?utm_source=meta&…»). */
export function enlaceTienda(web: string, nombrePauta: string, conUtm: boolean): string {
  const base = /^https?:\/\//.test(web) ? web : `https://${web}`
  if (!conUtm) return base
  const u = new URL(base)
  const campana = nombrePauta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'pauta'
  u.searchParams.set('utm_source', 'meta')
  u.searchParams.set('utm_medium', 'pauta')
  u.searchParams.set('utm_campaign', campana)
  return u.toString()
}

/** Segmentación de Meta a partir del público guardado (la región y los intereses ya buscados en Meta). */
export function armarSegmentacion(p: PublicoPauta, ubicaciones: UbicacionesPauta, extra: { region: { key: string } | null; intereses: { id: string; name: string }[] }) {
  const geo =
    p.zona.tipo === 'radio'
      ? { custom_locations: [{ latitude: p.zona.lat, longitude: p.zona.lng, radius: p.zona.km, distance_unit: 'kilometer' }] }
      : { regions: extra.region ? [{ key: extra.region.key }] : [] }
  const redes = ubicaciones === 'ig' ? ['instagram'] : ubicaciones === 'fb' ? ['facebook'] : ['facebook', 'instagram']
  return {
    geo_locations: geo,
    age_min: p.edadMin,
    age_max: p.edadMax,
    ...(p.generos === 'mujeres' ? { genders: [2] } : p.generos === 'hombres' ? { genders: [1] } : {}),
    ...(extra.intereses.length ? { flexible_spec: [{ interests: extra.intereses }] } : {}),
    publisher_platforms: redes,
    ...(redes.includes('facebook') ? { facebook_positions: ['feed', 'story', 'facebook_reels'] } : {}),
    ...(redes.includes('instagram') ? { instagram_positions: ['stream', 'story', 'reels'] } : {}),
    targeting_automation: { advantage_audience: p.advantage ? 1 : 0 },
  }
}

/** Resumen en una línea del público: «Formosa Capital y 15 km alrededor · 18 a 65+ · todos…». */
export function resumenPublico(p: PublicoPauta): string {
  const zona = p.zona.tipo === 'radio' ? `${p.zona.nombre} y ${p.zona.km} km alrededor` : `Provincia de ${p.zona.nombre}`
  const edad = `${p.edadMin} a ${p.edadMax}${p.edadMax >= 65 ? '+' : ''}`
  const generos = p.generos === 'todos' ? 'todos los géneros' : p.generos
  const intereses = p.intereses.length ? `${p.advantage ? 'Meta amplía el público (Advantage+) partiendo de' : 'intereses:'} ${p.intereses.join(', ').toLowerCase()}` : p.advantage ? 'Meta amplía el público (Advantage+)' : ''
  return [zona, edad, generos, intereses].filter(Boolean).join(' · ')
}
