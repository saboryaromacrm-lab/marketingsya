import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { gte, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { leerAjuste } from '@/lib/ajustes'
import { leerConfig } from '@/lib/configuracion'
import type { Config, ModeloIA } from '@/lib/configuracion-tipos'
import { hoyFormosa } from '@/lib/promos/fechas'
import { descifrar } from './cifrado'
import { costo, type TipoPedido } from './precios'

const { iaConsumos } = esquema

export class ErrorIA extends Error {}

/** Clave de Anthropic: la cargada en Configuración; si no hay, la variable de entorno ANTHROPIC_API_KEY. */
export async function claveIA(): Promise<{ clave: string | null; origen: 'configuracion' | 'entorno' | null }> {
  const guardada = await leerAjuste('ia_clave')
  const c = guardada ? descifrar(guardada) : null
  if (c) return { clave: c, origen: 'configuracion' }
  if (process.env.ANTHROPIC_API_KEY) return { clave: process.env.ANTHROPIC_API_KEY, origen: 'entorno' }
  return { clave: null, origen: null }
}

export const clienteIA = (clave: string) =>
  // ANTHROPIC_BASE_URL solo se usa en las pruebas (un servidor de prueba que imita la API)
  new Anthropic({ apiKey: clave, baseURL: process.env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 180_000 })

/** Primer día del mes actual en Formosa (UTC−3), como instante. */
export function inicioDelMes(hoy = hoyFormosa()): Date {
  return new Date(`${hoy.slice(0, 7)}-01T03:00:00Z`)
}

export async function gastoDelMes(): Promise<number> {
  const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${iaConsumos.costo}), 0)::float` }).from(iaConsumos).where(gte(iaConsumos.creadoEn, inicioDelMes()))
  return total
}

export type EstadoIA = { conectada: boolean; origen: 'configuracion' | 'entorno' | null; finClave: string | null; modelo: ModeloIA; gasto: number; tope: number; avisoPct: number; cortar: boolean; aviso: boolean; cortada: boolean }

export async function estadoIA(config?: Config): Promise<EstadoIA> {
  const c = config ?? (await leerConfig())
  const [{ clave, origen }, gasto] = await Promise.all([claveIA(), gastoDelMes()])
  const tope = c.ia.topeTexto
  return {
    conectada: !!clave, origen, finClave: clave ? clave.slice(-4) : null, modelo: c.ia.modelo,
    gasto, tope, avisoPct: c.ia.avisoPct, cortar: c.ia.cortar,
    aviso: tope > 0 && gasto >= (tope * c.ia.avisoPct) / 100,
    cortada: c.ia.cortar && gasto >= tope,
  }
}

const ESFUERZO = { rapida: 'low', normal: 'medium', fondo: 'high' } as const

type Pedido = {
  tipo: TipoPedido
  system: string | string[] // cada bloque va al caché (por ejemplo: la marca y la lista del catálogo)
  mensajes: Anthropic.Beta.BetaMessageParam[]
  esquema?: Record<string, unknown> // salida en JSON con este esquema
  maxTokens?: number
}

/**
 * Un pedido a Claude: revisa el tope del mes antes de llamar, registra el costo y devuelve el texto (o el JSON).
 * En Opus 5.5 y Sonnet 5.5 va con el respaldo del servidor: si el modelo rechaza un pedido por seguridad,
 * Anthropic lo reintenta solo con otro modelo.
 */
export async function llamarClaude<T = unknown>(p: Pedido): Promise<{ texto: string; json: T | null; costo: number }> {
  const config = await leerConfig()
  const { clave } = await claveIA()
  if (!clave) throw new ErrorIA('Todavía no cargaste la clave de Anthropic: andá a Configuración › Asesor IA.')
  const gasto = await gastoDelMes()
  if (config.ia.cortar && gasto >= config.ia.topeTexto) throw new ErrorIA(`Llegaste al tope del mes (US$ ${config.ia.topeTexto}). Se habilita de nuevo el día 1, o subí el tope en Configuración.`)

  const modelo = config.ia.modelo
  const conRespaldo = modelo !== 'claude-haiku-5-5'
  let r: Anthropic.Beta.BetaMessage
  try {
    r = await clienteIA(clave).beta.messages.create({
      model: modelo,
      max_tokens: p.maxTokens ?? 16000,
      // Las instrucciones de la marca son siempre iguales: van al caché (más barato desde el segundo pedido)
      system: (Array.isArray(p.system) ? p.system : [p.system]).map((text) => ({ type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } })),
      messages: p.mensajes,
      output_config: { effort: ESFUERZO[config.ia.profundidad], ...(p.esquema ? { format: { type: 'json_schema', schema: p.esquema } } : {}) },
      ...(conRespaldo ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorIA('La clave de Anthropic no es válida. Revisala en Configuración › Asesor IA.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new ErrorIA('La clave no tiene permiso para usar este modelo.')
    if (e instanceof Anthropic.RateLimitError) throw new ErrorIA('Anthropic está con mucha demanda. Probá de nuevo en un minuto.')
    if (e instanceof Anthropic.APIConnectionError) throw new ErrorIA('No se pudo conectar con Anthropic. Revisá la conexión y probá de nuevo.')
    if (e instanceof Anthropic.APIError) throw new ErrorIA(`Anthropic no aceptó el pedido (${e.status}). Si dice que falta saldo, cargá crédito en console.anthropic.com.`)
    throw e
  }

  const u = { entrada: r.usage.input_tokens, salida: r.usage.output_tokens, cacheLectura: r.usage.cache_read_input_tokens ?? 0, cacheEscritura: r.usage.cache_creation_input_tokens ?? 0 }
  const c = costo(r.model, u)
  await db.insert(iaConsumos).values({ tipo: p.tipo, modelo: r.model, ...u, costo: c })

  if (r.stop_reason === 'refusal') throw new ErrorIA('La IA no quiso responder ese pedido. Probá escribiéndolo de otra forma.')
  if (r.stop_reason === 'max_tokens') throw new ErrorIA('La respuesta salió demasiado larga y se cortó. Probá pedir algo más acotado.')
  const texto = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
  let json: T | null = null
  if (p.esquema) {
    try { json = JSON.parse(texto) as T } catch { throw new ErrorIA('La respuesta de la IA vino incompleta. Probá de nuevo.') }
  }
  return { texto, json, costo: c }
}
