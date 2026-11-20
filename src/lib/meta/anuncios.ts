import 'server-only'
import type { Graph } from './graph'
import { ErrorMeta } from './errores'
import type { CuentasMeta } from './conexion'
import { deUnidadMinima, type Insight } from '@/lib/pautas/reglas'

// La API de anuncios de Meta (Marketing API): cuenta publicitaria, campaña → conjunto → creativo → anuncio, y resultados.

export type CuentaPublicitaria = { id: string; nombre: string; moneda: string; zona: string; activa: boolean; minDiario: number | null }
export type Publicidad = CuentaPublicitaria & { cuentas: { id: string; nombre: string; moneda: string }[]; whatsapp: string | null; comprobadoEn: string }

type FilaCuenta = { id: string; name?: string; currency?: string; timezone_name?: string; account_status?: number; min_daily_budget?: number | string }

/** Las cuentas publicitarias que ve el token; elige la de antes o la primera activa. */
export async function detectarPublicidad(g: Graph, cuentas: CuentasMeta, preferida?: string | null): Promise<Publicidad> {
  const r = await g.get<{ data?: FilaCuenta[] }>('me/adaccounts', { fields: 'id,name,currency,timezone_name,account_status,min_daily_budget', limit: 50 })
  const filas = r.data ?? []
  if (!filas.length) throw new ErrorMeta({ mensaje: 'El token no ve ninguna cuenta publicitaria. Asignásela al usuario del sistema (control total) en Meta Business.', reintentable: false })
  const f = filas.find((x) => x.id === preferida) ?? filas.find((x) => x.account_status === 1) ?? filas[0]
  // El WhatsApp vinculado a la página (si Meta deja leerlo; si no, no frena)
  const whatsapp = await g.get<{ whatsapp_number?: string }>(cuentas.paginaId, { fields: 'whatsapp_number' }).then((x) => x.whatsapp_number ?? null).catch(() => null)
  return {
    id: f.id,
    nombre: f.name ?? f.id,
    moneda: f.currency ?? 'ARS',
    zona: f.timezone_name ?? '',
    activa: f.account_status === 1,
    minDiario: f.min_daily_budget != null ? deUnidadMinima(f.min_daily_budget) : null,
    cuentas: filas.map((x) => ({ id: x.id, nombre: x.name ?? x.id, moneda: x.currency ?? '' })),
    whatsapp,
    comprobadoEn: new Date().toISOString(),
  }
}

/** Provincia o región por nombre (para «Provincia de Formosa»). */
export async function buscarRegion(g: Graph, nombre: string): Promise<{ key: string; name: string } | null> {
  const r = await g.get<{ data?: { key: string; name: string; country_code?: string }[] }>('search', { type: 'adgeolocation', location_types: JSON.stringify(['region']), q: nombre, country_code: 'AR', limit: 5 })
  return r.data?.[0] ? { key: r.data[0].key, name: r.data[0].name } : null
}

/** Intereses por nombre: se toma el primero que encuentra Meta para cada uno (los que no existen se saltean). */
export async function buscarIntereses(g: Graph, nombres: string[]): Promise<{ id: string; name: string }[]> {
  const encontrados: { id: string; name: string }[] = []
  for (const q of nombres.slice(0, 10)) {
    const r = await g.get<{ data?: { id: string; name: string }[] }>('search', { type: 'adinterest', q, limit: 1 }).catch(() => ({ data: [] }))
    const x = r.data?.[0]
    if (x && !encontrados.some((e) => e.id === x.id)) encontrados.push({ id: x.id, name: x.name })
  }
  return encontrados
}

export type NuevaCampana = {
  cuenta: string // act_…
  nombre: string
  objetivo: string
  optimizacion: string
  destino?: string
  presupuesto: number // unidad mínima (centavos)
  inicio: string
  fin: string
  segmentacion: Record<string, unknown>
  paginaId: string
  creativo: { instagram: { usuario: string; media: string } | null; facebookPost: string | null; llamado: Record<string, unknown> | null }
}

export type CampanaCreada = { campana: string; conjunto: string; creativo: string; anuncio: string; dudosa: boolean }

/**
 * Crea todo en pausa y recién al final activa la campaña. Si algo falla en el medio, se borra lo creado:
 * nunca queda una campaña a medias gastando.
 */
export async function crearCampana(g: Graph, c: NuevaCampana): Promise<CampanaCreada> {
  const { id: campana } = await g.post<{ id: string }>(`${c.cuenta}/campaigns`, {
    name: c.nombre, objective: c.objetivo, status: 'PAUSED', buying_type: 'AUCTION', special_ad_categories: '[]', is_adset_budget_sharing_enabled: false,
  })
  try {
    const { id: conjunto } = await g.post<{ id: string }>(`${c.cuenta}/adsets`, {
      name: c.nombre,
      campaign_id: campana,
      lifetime_budget: c.presupuesto,
      start_time: c.inicio,
      end_time: c.fin,
      billing_event: 'IMPRESSIONS',
      optimization_goal: c.optimizacion,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destination_type: c.destino,
      promoted_object: c.destino === 'WHATSAPP' ? JSON.stringify({ page_id: c.paginaId }) : undefined,
      targeting: JSON.stringify(c.segmentacion),
      status: 'ACTIVE',
    })
    const creativo = await crearCreativo(g, c)
    const { id: anuncio } = await g.post<{ id: string }>(`${c.cuenta}/ads`, { name: c.nombre, adset_id: conjunto, creative: JSON.stringify({ creative_id: creativo }), status: 'ACTIVE' })
    try {
      await g.post(campana, { status: 'ACTIVE' }, { final: true })
      return { campana, conjunto, creativo, anuncio, dudosa: false }
    } catch (e) {
      // Se cortó al activar: puede haber quedado activa. Se guarda igual y la próxima actualización lo confirma.
      if (e instanceof ErrorMeta && e.dudoso) return { campana, conjunto, creativo, anuncio, dudosa: true }
      throw e
    }
  } catch (e) {
    await g.post(campana, { status: 'DELETED' }).catch(() => {})
    throw e
  }
}

async function crearCreativo(g: Graph, c: NuevaCampana): Promise<string> {
  if (c.creativo.instagram) {
    const base = { name: c.nombre, object_id: c.paginaId, source_instagram_media_id: c.creativo.instagram.media, call_to_action: c.creativo.llamado ? JSON.stringify(c.creativo.llamado) : undefined }
    try {
      return (await g.post<{ id: string }>(`${c.cuenta}/adcreatives`, { ...base, instagram_user_id: c.creativo.instagram.usuario })).id
    } catch (e) {
      // Versiones anteriores de la API usaban otro nombre para la cuenta de Instagram
      if (e instanceof ErrorMeta && e.codigo === 100 && /instagram_user_id/i.test(e.message)) {
        return (await g.post<{ id: string }>(`${c.cuenta}/adcreatives`, { ...base, instagram_actor_id: c.creativo.instagram.usuario })).id
      }
      throw e
    }
  }
  if (!c.creativo.facebookPost) throw new ErrorMeta({ mensaje: 'La publicación no tiene un posteo para pautar.', reintentable: false })
  return (await g.post<{ id: string }>(`${c.cuenta}/adcreatives`, { name: c.nombre, object_story_id: c.creativo.facebookPost })).id
}

export type EstadoAnuncio = { estado: string | null; rechazo: string | null; problema: string | null }

export async function leerAnuncio(g: Graph, anuncio: string): Promise<EstadoAnuncio> {
  const r = await g.get<{ effective_status?: string; ad_review_feedback?: { global?: Record<string, string> }; issues_info?: { error_message?: string; error_summary?: string }[] }>(anuncio, { fields: 'effective_status,ad_review_feedback,issues_info' })
  const rechazo = r.ad_review_feedback?.global ? Object.values(r.ad_review_feedback.global).join(' ') : null
  const problema = r.issues_info?.[0] ? (r.issues_info[0].error_message || r.issues_info[0].error_summary || null) : r.effective_status === 'PENDING_BILLING_INFO' ? 'Falta el medio de pago en la cuenta publicitaria.' : null
  return { estado: r.effective_status ?? null, rechazo, problema }
}

export async function leerResultados(g: Graph, campana: string): Promise<Insight | null> {
  const r = await g.get<{ data?: Insight[] }>(`${campana}/insights`, { fields: 'spend,reach,impressions,inline_link_clicks,actions', date_preset: 'maximum' })
  return r.data?.[0] ?? null
}

export const cambiarEstadoCampana = (g: Graph, campana: string, estado: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') => g.post(campana, { status: estado })

export const cambiarPresupuestoConjunto = (g: Graph, conjunto: string, presupuesto: number, fin: string) => g.post(conjunto, { lifetime_budget: presupuesto, end_time: fin })
