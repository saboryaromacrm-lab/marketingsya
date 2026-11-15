// Formatos argentinos, siempre en hora de Formosa (UTC−3).
const ZONA = 'America/Argentina/Cordoba'

const pesosFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const numeroFmt = new Intl.NumberFormat('es-AR')
const fechaHoraFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONA })
const horaFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONA })
const diaFmt = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeZone: ZONA })

export const pesos = (n: number | null | undefined) => (n == null ? '—' : `$ ${pesosFmt.format(Math.round(n))}`)
export const numero = (n: number) => numeroFmt.format(n)
export const fechaHora = (d: Date) => fechaHoraFmt.format(d)

// «hoy 16:43», «ayer 09:10», «12/11/26 18:00»
export function cuando(d: Date, ahora = new Date()) {
  const dia = diaFmt.format(d)
  if (dia === diaFmt.format(ahora)) return `hoy ${horaFmt.format(d)}`
  if (dia === diaFmt.format(new Date(ahora.getTime() - 864e5))) return `ayer ${horaFmt.format(d)}`
  return fechaHoraFmt.format(d)
}

export function duracion(desde: Date, hasta: Date) {
  const s = Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 1000))
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

export const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`
