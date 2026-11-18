// Fechas de las promos, siempre en hora de Formosa. Se guardan como texto AAAA-MM-DD.
const ZONA = 'America/Argentina/Cordoba'

export function hoyFormosa(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export const esFecha = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

/** «DEL 18/11 AL 30/11» (el año se agrega solo si no es el mismo). */
export function textoVigencia(desde: string, hasta: string): string {
  const corta = (f: string, conAnio: boolean) => `${f.slice(8, 10)}/${f.slice(5, 7)}${conAnio ? `/${f.slice(2, 4)}` : ''}`
  const distintoAnio = desde.slice(0, 4) !== hasta.slice(0, 4)
  return desde === hasta ? `SOLO EL ${corta(desde, false)}` : `DEL ${corta(desde, distintoAnio)} AL ${corta(hasta, distintoAnio)}`
}

export type EstadoPromo = 'por-empezar' | 'vigente' | 'vencida'
export function estadoPromo(desde: string, hasta: string, hoy = hoyFormosa()): EstadoPromo {
  if (hoy < desde) return 'por-empezar'
  if (hoy > hasta) return 'vencida'
  return 'vigente'
}
