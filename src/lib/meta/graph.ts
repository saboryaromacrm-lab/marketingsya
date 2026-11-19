import 'server-only'
import { ErrorMeta, errorDeRed, traducirError } from './errores'

// Cliente mínimo de la API de Meta (Graph API). Sin paquetes: son pedidos HTTP simples.
// META_GRAPH_URL solo se usa en las pruebas (un servidor que imita a Meta).
const base = () => (process.env.META_GRAPH_URL || 'https://graph.facebook.com').replace(/\/+$/, '')

type Parametros = Record<string, string | number | boolean | undefined | null>

export type Graph = {
  get<T = Record<string, unknown>>(ruta: string, parametros?: Parametros): Promise<T>
  /** `final`: el pedido que publica. Si se corta sin respuesta, no se sabe si salió (no se reintenta solo). */
  post<T = Record<string, unknown>>(ruta: string, parametros?: Parametros, opciones?: { final?: boolean }): Promise<T>
}

function limpiar(p: Parametros, token: string) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v != null && v !== '') u.set(k, String(v))
  u.set('access_token', token)
  return u
}

export function graph(token: string, version: string): Graph {
  async function pedir<T>(metodo: 'GET' | 'POST', ruta: string, parametros: Parametros, final = false): Promise<T> {
    const datos = limpiar(parametros, token)
    const url = `${base()}/${version}/${ruta.replace(/^\/+/, '')}`
    let res: Response
    try {
      res = await fetch(metodo === 'GET' ? `${url}?${datos}` : url, {
        method: metodo,
        body: metodo === 'POST' ? datos : undefined,
        headers: metodo === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined,
        signal: AbortSignal.timeout(final ? 90_000 : 30_000),
        cache: 'no-store',
      })
    } catch {
      throw errorDeRed(final)
    }
    const texto = await res.text()
    let cuerpo: unknown = null
    try { cuerpo = texto ? JSON.parse(texto) : null } catch { /* respuesta que no es JSON */ }
    if (!res.ok || (cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo)) {
      const info = traducirError(cuerpo, res.status)
      // Al registro va el detalle de Meta (nunca el token)
      console.warn(`[meta] ${metodo} ${ruta.split('?')[0]} → ${res.status}`, JSON.stringify((cuerpo as { error?: unknown } | null)?.error ?? texto.slice(0, 300)))
      throw new ErrorMeta(info)
    }
    return (cuerpo ?? {}) as T
  }
  return {
    get: (ruta, p = {}) => pedir('GET', ruta, p),
    post: (ruta, p = {}, o = {}) => pedir('POST', ruta, p, o.final),
  }
}
