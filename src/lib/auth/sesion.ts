import { createHmac, timingSafeEqual } from 'node:crypto'

// La sesión es una cookie firmada: no hace falta guardarla en la base.
// Contenido: fecha de vencimiento + firma HMAC con SESION_SECRETO.
// Cambiar el secreto invalida todas las sesiones abiertas.

export const COOKIE_SESION = 'sya_sesion'

function firmar(datos: string, secreto: string) {
  return createHmac('sha256', secreto).update(datos).digest('base64url')
}

export function crearToken(secreto: string, dias: number, ahora = Date.now()) {
  const vence = ahora + dias * 24 * 60 * 60 * 1000
  const datos = Buffer.from(JSON.stringify({ v: vence })).toString('base64url')
  return { token: `${datos}.${firmar(datos, secreto)}`, vence: new Date(vence) }
}

export function tokenValido(token: string | undefined, secreto: string, ahora = Date.now()): boolean {
  if (!token) return false
  const [datos, firma] = token.split('.')
  if (!datos || !firma) return false
  const esperada = Buffer.from(firmar(datos, secreto))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return false
  try {
    const { v } = JSON.parse(Buffer.from(datos, 'base64url').toString())
    return typeof v === 'number' && v > ahora
  } catch {
    return false
  }
}
