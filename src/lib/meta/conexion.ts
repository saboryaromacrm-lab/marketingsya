import 'server-only'
import { borrarAjuste, guardarAjuste, leerAjuste } from '@/lib/ajustes'
import { cifrar, descifrar } from '@/lib/ia/cifrado'
import { leerConfig } from '@/lib/configuracion'
import { graph, type Graph } from './graph'
import { ErrorMeta } from './errores'

// Conexión con Meta: el token del usuario del sistema (cifrado en la base) y las cuentas que se detectan con él.

export const PERMISOS_NECESARIOS = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'] as const

export type PaginaMeta = { id: string; nombre: string; instagramId: string | null; instagramUsuario: string | null }
export type CuentasMeta = {
  paginaId: string
  paginaNombre: string
  instagramId: string | null
  instagramUsuario: string | null
  paginas: PaginaMeta[]
  vence: string | null // fecha ISO; null = no vence
  permisos: string[] | null // null = no se pudieron leer
  faltan: string[]
  comprobadoEn: string
}

export type EstadoMeta = { conectada: boolean; finToken: string | null; cuentas: CuentasMeta | null }

export async function leerToken(): Promise<string | null> {
  const guardado = await leerAjuste('meta_token')
  return guardado ? descifrar(guardado, 'token-meta') : null
}

export async function leerCuentas(): Promise<CuentasMeta | null> {
  const v = await leerAjuste('meta_cuentas')
  if (!v) return null
  try { return JSON.parse(v) as CuentasMeta } catch { return null }
}

export async function estadoMeta(): Promise<EstadoMeta> {
  const [token, cuentas] = await Promise.all([leerToken(), leerCuentas()])
  return { conectada: !!token && !!cuentas, finToken: token ? token.slice(-4) : null, cuentas: token ? cuentas : null }
}

/** Cliente de Graph con el token guardado (o el error claro si no hay conexión). */
export async function clienteMeta(): Promise<{ g: Graph; cuentas: CuentasMeta }> {
  const [token, cuentas, config] = await Promise.all([leerToken(), leerCuentas(), leerConfig()])
  if (!token || !cuentas) throw new ErrorMeta({ mensaje: 'Meta no está conectado: cargá el token en Configuración › Meta.', reintentable: false, token: true })
  return { g: graph(token, config.meta.versionApi), cuentas }
}

type Cuenta = { id: string; name?: string; instagram_business_account?: { id: string; username?: string } }

/** Con el token, busca las páginas asignadas y su Instagram de empresa, el vencimiento y los permisos. */
export async function detectarCuentas(token: string, version: string, paginaPreferida?: string | null): Promise<CuentasMeta> {
  const g = graph(token, version)
  const r = await g.get<{ data?: Cuenta[] }>('me/accounts', { fields: 'id,name,instagram_business_account{id,username}', limit: 100 })
  const paginas: PaginaMeta[] = (r.data ?? []).map((p) => ({ id: p.id, nombre: p.name ?? p.id, instagramId: p.instagram_business_account?.id ?? null, instagramUsuario: p.instagram_business_account?.username ?? null }))
  if (!paginas.length) {
    throw new ErrorMeta({ mensaje: 'El token anda, pero no tiene ninguna página asignada. En Meta, asignale la página de Facebook (y el Instagram) al usuario del sistema y generá el token de nuevo.', reintentable: false })
  }
  // La elegida antes; si no, la primera con Instagram vinculado
  const elegida = paginas.find((p) => p.id === paginaPreferida) ?? paginas.find((p) => p.instagramId) ?? paginas[0]

  // Vencimiento y permisos: si Meta no deja leerlos, no frena la conexión
  let vence: string | null = null
  let permisos: string[] | null = null
  try {
    const d = await g.get<{ data?: { expires_at?: number; scopes?: string[] } }>('debug_token', { input_token: token })
    const exp = d.data?.expires_at ?? 0
    vence = exp > 0 ? new Date(exp * 1000).toISOString() : null
    permisos = d.data?.scopes ?? null
  } catch { /* sigue sin el dato */ }
  if (!permisos) {
    try {
      const p = await g.get<{ data?: { permission: string; status: string }[] }>('me/permissions')
      permisos = (p.data ?? []).filter((x) => x.status === 'granted').map((x) => x.permission)
    } catch { /* sigue sin el dato */ }
  }
  return {
    paginaId: elegida.id,
    paginaNombre: elegida.nombre,
    instagramId: elegida.instagramId,
    instagramUsuario: elegida.instagramUsuario,
    paginas,
    vence,
    permisos,
    faltan: permisos ? PERMISOS_NECESARIOS.filter((x) => !permisos!.includes(x)) : [],
    comprobadoEn: new Date().toISOString(),
  }
}

export async function guardarConexion(token: string, cuentas: CuentasMeta) {
  await guardarAjuste('meta_token', cifrar(token, 'token-meta'))
  await guardarAjuste('meta_cuentas', JSON.stringify(cuentas))
}

export async function guardarCuentas(cuentas: CuentasMeta) {
  await guardarAjuste('meta_cuentas', JSON.stringify(cuentas))
}

export async function borrarConexion() {
  await borrarAjuste('meta_token')
  await borrarAjuste('meta_cuentas')
}

/** Cuántas publicaciones usó Instagram en las últimas 24 horas (el tope es 100). null si no se pudo leer. */
export async function cuotaInstagram(): Promise<{ usadas: number; total: number } | null> {
  try {
    const { g, cuentas } = await clienteMeta()
    if (!cuentas.instagramId) return null
    const r = await g.get<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(`${cuentas.instagramId}/content_publishing_limit`, { fields: 'quota_usage,config' })
    const d = r.data?.[0]
    return d ? { usadas: d.quota_usage ?? 0, total: d.config?.quota_total ?? 100 } : null
  } catch {
    return null
  }
}

/** Token de la página (las publicaciones en Facebook se hacen con ese, no con el del usuario del sistema). */
export async function tokenDePagina(g: Graph, paginaId: string): Promise<string> {
  const r = await g.get<{ access_token?: string }>(paginaId, { fields: 'access_token' })
  if (!r.access_token) throw new ErrorMeta({ mensaje: 'Meta no dio permiso para publicar en la página. Revisá que el usuario del sistema tenga la página asignada con control total.', reintentable: false })
  return r.access_token
}
