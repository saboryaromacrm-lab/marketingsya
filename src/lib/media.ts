import 'server-only'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { entorno } from '@/lib/entorno'

// Archivos públicos (fotos, logos, piezas) guardados en MEDIA_DIR.
// Se sirven en /media/<ruta>. Meta necesita poder leerlos sin sesión.

const TIPOS: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg' }
export const TIPO_POR_EXTENSION: Record<string, string> = { ...Object.fromEntries(Object.entries(TIPOS).map(([t, e]) => [e, t])), zip: 'application/zip' }
const MAXIMO = 8 * 1024 * 1024

// Error con el código HTTP, para poder distinguir «esperá un poco» (429) de «no existe» (404).
export class ErrorDeDescarga extends Error {
  constructor(public estado: number, public esperarSegundos: number | null) {
    super(estado === 429 ? 'el servidor pidió esperar (429)' : `respondió ${estado}`)
  }
}

function leerRetryAfter(valor: string | null): number | null {
  if (!valor) return null
  const n = Number(valor)
  if (Number.isFinite(n)) return Math.max(0, n)
  const fecha = Date.parse(valor)
  return Number.isNaN(fecha) ? null : Math.max(0, Math.ceil((fecha - Date.now()) / 1000))
}

// Convierte una ruta relativa en absoluta, sin dejar salir de MEDIA_DIR.
export function rutaSegura(relativa: string): string | null {
  const base = path.resolve(entorno.mediaDir)
  const destino = path.resolve(base, relativa)
  return destino.startsWith(base + path.sep) ? destino : null
}

export const urlMedia = (relativa: string) => `/media/${relativa}`

/**
 * Descarga una imagen y la guarda como <sinExtension>.<ext>, según el tipo que informe el servidor.
 * Escribe primero a un temporal y después renombra: nunca queda una foto a medias.
 */
export async function descargarImagen(url: string, sinExtension: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
  if (!res.ok) throw new ErrorDeDescarga(res.status, leerRetryAfter(res.headers.get('retry-after')))
  const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  const ext = TIPOS[tipo]
  if (!ext) throw new Error(`no es una imagen (${tipo || 'sin tipo'})`)
  const datos = Buffer.from(await res.arrayBuffer())
  if (datos.length === 0) throw new Error('vino vacía')
  if (datos.length > MAXIMO) throw new Error('pesa más de 8 MB')

  const relativa = `${sinExtension}.${ext}`
  const destino = rutaSegura(relativa)
  if (!destino) throw new Error('ruta inválida')
  await mkdir(path.dirname(destino), { recursive: true })
  const temporal = `${destino}.${process.pid}.tmp`
  await writeFile(temporal, datos)
  await rename(temporal, destino)
  return relativa
}

/** Guarda un archivo ya procesado (escribe a un temporal y renombra). */
export async function guardarMedia(relativa: string, datos: Buffer) {
  const destino = rutaSegura(relativa)
  if (!destino) throw new Error('ruta inválida')
  await mkdir(path.dirname(destino), { recursive: true })
  const temporal = `${destino}.${process.pid}.tmp`
  await writeFile(temporal, datos)
  await rename(temporal, destino)
}

export async function borrarMedia(relativa: string | null | undefined) {
  if (!relativa) return
  const destino = rutaSegura(relativa)
  if (destino) await rm(destino, { force: true })
}
