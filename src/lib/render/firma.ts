import { createHmac, timingSafeEqual } from 'node:crypto'

// Las placas se arman en rutas /render/... que abre Chromium desde adentro del servidor.
// Para que no queden abiertas a cualquiera, Chromium entra con una firma temporal de esa dirección exacta
// (ruta y parámetros, sin el propio «firma»).
// (Lucas, con su sesión, también las puede ver: así funciona la vista previa del editor.)

const firmar = (datos: string, secreto: string) => createHmac('sha256', secreto).update(`render:${datos}`).digest('base64url')

export function firmaDeRuta(ruta: string, secreto: string, segundos = 600, ahora = Date.now()): string {
  const datos = Buffer.from(JSON.stringify({ r: ruta, v: ahora + segundos * 1000 })).toString('base64url')
  return `${datos}.${firmar(datos, secreto)}`
}

export function firmaValida(firma: string | null, ruta: string, secreto: string, ahora = Date.now()): boolean {
  if (!firma || !secreto) return false
  const [datos, recibida] = firma.split('.')
  if (!datos || !recibida) return false
  const a = Buffer.from(firmar(datos, secreto))
  const b = Buffer.from(recibida)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const { r, v } = JSON.parse(Buffer.from(datos, 'base64url').toString())
    return r === ruta && typeof v === 'number' && v > ahora
  } catch {
    return false
  }
}

/**
 * Forma única de escribir una dirección para firmarla o verificarla: ruta + parámetros (sin «firma»),
 * serializados siempre igual. Si un lado escribe «1,2» y el otro «1%2C2», la firma no coincidiría.
 */
export function rutaCanonica(pathname: string, parametros: URLSearchParams): string {
  const resto = new URLSearchParams(parametros)
  resto.delete('firma')
  return pathname + (resto.size ? `?${resto}` : '')
}
