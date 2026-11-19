// Traduce los errores de la API de Meta (Graph API) a mensajes claros para Lucas
// y decide si conviene reintentar. Puro: se prueba sin red.

export type InfoError = {
  mensaje: string
  // Vale la pena volver a probar en unos minutos (Meta caído, límite de pedidos, imagen que todavía no bajó…)
  reintentable: boolean
  // El problema es el token (venció, se revocó): hay que cargar otro
  token?: boolean
  codigo?: number
  subcodigo?: number
}

export class ErrorMeta extends Error {
  reintentable: boolean
  token: boolean
  // No se sabe si salió: el pedido final se cortó sin respuesta. Nunca se reintenta solo (podría salir dos veces).
  dudoso: boolean
  codigo?: number
  constructor(info: InfoError, dudoso = false) {
    super(info.mensaje)
    this.reintentable = info.reintentable && !dudoso
    this.token = !!info.token
    this.dudoso = dudoso
    this.codigo = info.codigo
  }
}

type CuerpoError = { error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean; error_user_msg?: string; error_user_title?: string } }

export function traducirError(cuerpo: unknown, estado: number): InfoError {
  const e = (cuerpo && typeof cuerpo === 'object' ? (cuerpo as CuerpoError).error : undefined) ?? {}
  const codigo = typeof e.code === 'number' ? e.code : undefined
  const subcodigo = typeof e.error_subcode === 'number' ? e.error_subcode : undefined
  const original = (e.error_user_msg || e.message || '').trim()
  const con = (mensaje: string, reintentable: boolean, extra: Partial<InfoError> = {}): InfoError => ({ mensaje, reintentable, codigo, subcodigo, ...extra })

  if (codigo === 190 || codigo === 102 || codigo === 463 || codigo === 467) {
    return con('Meta dice que el token no es válido o venció. Cargá uno nuevo en Configuración › Meta.', false, { token: true })
  }
  if (subcodigo === 2207042 || /publishing limit/i.test(original)) {
    return con('Instagram llegó al límite de 100 publicaciones en 24 horas. Programala para mañana.', false)
  }
  if (codigo === 10 || (codigo != null && codigo >= 200 && codigo <= 299)) {
    return con(`Al token le falta un permiso para esto. Revisá los permisos del usuario del sistema en Meta${original ? ` (Meta dice: «${original}»)` : ''}.`, false)
  }
  if (codigo === 4 || codigo === 17 || codigo === 32 || codigo === 613 || codigo === 80001 || codigo === 80002) {
    return con('Meta pidió esperar un rato: hubo demasiados pedidos seguidos.', true)
  }
  if (codigo === 9004 || subcodigo === 2207052 || subcodigo === 2207003 || /media download|could not be fetched|failed to download/i.test(original)) {
    return con('Meta no pudo descargar la imagen desde la plataforma. Revisá que la dirección pública (Configuración › Meta) abra desde afuera.', true)
  }
  if (codigo === 36003 || subcodigo === 2207009 || subcodigo === 2207004) {
    return con('Instagram rechazó la medida o el peso de la imagen.', false)
  }
  if (codigo === 9007 || subcodigo === 2207027) {
    return con('Instagram todavía estaba procesando las imágenes.', true)
  }
  if (codigo === 368) {
    return con('Meta frenó la publicación por sus políticas. Revisá los avisos de la cuenta en Meta Business Suite.', false)
  }
  if (codigo === 1 || codigo === 2 || e.is_transient || estado >= 500) {
    return con('Meta tuvo un problema momentáneo.', true)
  }
  return con(original ? `Meta respondió: «${original}»` : `Meta respondió con un error (${estado}).`, estado === 429)
}

/** Error de red (sin respuesta de Meta). */
export const errorDeRed = (dudoso: boolean) =>
  new ErrorMeta({ mensaje: dudoso ? 'Se cortó la conexión con Meta justo al publicar: no sabemos si salió. Fijate en Instagram o Facebook antes de reintentar.' : 'No se pudo conectar con Meta.', reintentable: true }, dudoso)
