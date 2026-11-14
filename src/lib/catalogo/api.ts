import 'server-only'
import { entorno } from '@/lib/entorno'

export type Descarga = { sinCambios: true } | { sinCambios: false; etag: string | null; datos: unknown }

// Baja el catálogo entero. Si se pasa el ETag de la última vez y no cambió,
// el ERP responde 304 y no hace falta reprocesar nada.
export async function descargarCatalogo(etagAnterior: string | null): Promise<Descarga> {
  let res: Response
  try {
    res = await fetch(entorno.catalogoUrl, {
      headers: { accept: 'application/json', ...(etagAnterior ? { 'if-none-match': etagAnterior } : {}) },
      signal: AbortSignal.timeout(90_000),
      cache: 'no-store',
    })
  } catch (e) {
    const motivo = e instanceof Error && e.name === 'TimeoutError' ? 'tardó más de 90 segundos' : 'no respondió'
    throw new Error(`El ERP ${motivo}. Probá de nuevo en un rato.`)
  }
  if (res.status === 304) return { sinCambios: true }
  if (!res.ok) throw new Error(`El ERP respondió con error ${res.status}. Probá de nuevo en un rato.`)
  let datos: unknown
  try {
    datos = await res.json()
  } catch {
    throw new Error('El ERP devolvió una respuesta que no es JSON.')
  }
  return { sinCambios: false, etag: res.headers.get('etag'), datos }
}
