import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Las claves (Anthropic, token de Meta) se guardan cifradas en la base (AES-256-GCM), con una llave derivada
// del secreto de sesión y distinta para cada uso. Nunca se muestran enteras: la pantalla solo ve los últimos 4 caracteres.
export type UsoClave = 'clave-ia' | 'token-meta'
const llave = (uso: UsoClave) => createHash('sha256').update(`${process.env.SESION_SECRETO ?? ''}:${uso}`).digest()

export function cifrar(texto: string, uso: UsoClave = 'clave-ia'): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', llave(uso), iv)
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), datos].map((b) => b.toString('base64')).join('.')
}

export function descifrar(guardado: string, uso: UsoClave = 'clave-ia'): string | null {
  try {
    const [iv, tag, datos] = guardado.split('.').map((x) => Buffer.from(x, 'base64'))
    const d = createDecipheriv('aes-256-gcm', llave(uso), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(datos), d.final()]).toString('utf8')
  } catch {
    return null
  }
}
