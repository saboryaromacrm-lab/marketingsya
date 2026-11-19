import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// La clave de Anthropic se guarda cifrada en la base (AES-256-GCM), con una llave derivada del secreto de sesión.
// Nunca se muestra entera: la pantalla solo ve los últimos 4 caracteres.
const llave = () => createHash('sha256').update(`${process.env.SESION_SECRETO ?? ''}:clave-ia`).digest()

export function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', llave(), iv)
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), datos].map((b) => b.toString('base64')).join('.')
}

export function descifrar(guardado: string): string | null {
  try {
    const [iv, tag, datos] = guardado.split('.').map((x) => Buffer.from(x, 'base64'))
    const d = createDecipheriv('aes-256-gcm', llave(), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(datos), d.final()]).toString('utf8')
  } catch {
    return null
  }
}
