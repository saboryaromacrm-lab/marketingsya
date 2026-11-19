// Fechas que sirven para el contenido de una dietética en Argentina. Las móviles se calculan solas.

export type FechaEspecial = { fecha: string; nombre: string; idea: string }

const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Domingo de Pascua (algoritmo de Gauss/Meeus para el calendario gregoriano). */
export function pascua(a: number): string {
  const b = a % 19, c = Math.floor(a / 100), d = a % 100
  const e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3)
  const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4
  const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451)
  const mes = Math.floor((i + m - 7 * n + 114) / 31), dia = ((i + m - 7 * n + 114) % 31) + 1
  return iso(a, mes, dia)
}

const sumar = (f: string, dias: number) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + dias); return x.toISOString().slice(0, 10) }

/** N-ésimo domingo de un mes (3er domingo de octubre = Día de la Madre). */
function domingo(a: number, mes: number, n: number): string {
  const primero = new Date(Date.UTC(a, mes - 1, 1, 12))
  const dia = 1 + ((7 - primero.getUTCDay()) % 7) + (n - 1) * 7
  return iso(a, mes, dia)
}

export function fechasDelAnio(a: number): FechaEspecial[] {
  const p = pascua(a)
  return [
    { fecha: iso(a, 1, 1), nombre: 'Año Nuevo', idea: 'propósitos de comer más sano' },
    { fecha: iso(a, 1, 6), nombre: 'Día de Reyes', idea: 'snacks y algo dulce para los chicos' },
    { fecha: iso(a, 2, 14), nombre: 'San Valentín', idea: 'chocolates y regalos saludables' },
    { fecha: sumar(p, -48), nombre: 'Carnaval', idea: 'snacks para compartir en el fin de semana largo' },
    { fecha: iso(a, 3, 1), nombre: 'Vuelta a clases', idea: 'viandas y colaciones saludables' },
    { fecha: iso(a, 3, 8), nombre: 'Día de la Mujer', idea: 'bienestar y autocuidado' },
    { fecha: iso(a, 4, 7), nombre: 'Día Mundial de la Salud', idea: 'hábitos saludables' },
    { fecha: p, nombre: 'Pascua', idea: 'huevos y chocolates sin culpa' },
    { fecha: iso(a, 5, 5), nombre: 'Día del Celíaco', idea: 'productos sin TACC' },
    { fecha: iso(a, 5, 25), nombre: '25 de Mayo', idea: 'locro, pastelitos y comidas patrias más livianas' },
    { fecha: domingo(a, 6, 3), nombre: 'Día del Padre', idea: 'regalos y picadas saludables' },
    { fecha: iso(a, 7, 9), nombre: '9 de Julio', idea: 'comidas patrias y fin de semana largo' },
    { fecha: iso(a, 7, 20), nombre: 'Día del Amigo', idea: 'picadas y mates para compartir' },
    { fecha: domingo(a, 8, 3), nombre: 'Día del Niño', idea: 'snacks ricos y sanos para chicos' },
    { fecha: iso(a, 9, 21), nombre: 'Día de la Primavera y del Estudiante', idea: 'picnic, frutos secos y mate al aire libre' },
    { fecha: iso(a, 10, 16), nombre: 'Día Mundial de la Alimentación', idea: 'comer rico, sano y que rinda' },
    { fecha: domingo(a, 10, 3), nombre: 'Día de la Madre', idea: 'regalos saludables y desayunos especiales' },
    { fecha: iso(a, 11, 1), nombre: 'Día Mundial del Veganismo', idea: 'opciones veganas' },
    { fecha: iso(a, 12, 8), nombre: 'Feriado del 8 de diciembre', idea: 'armado del arbolito y picadas' },
    { fecha: iso(a, 12, 24), nombre: 'Nochebuena y Navidad', idea: 'frutos secos, garrapiñadas y mesa navideña' },
    { fecha: iso(a, 12, 31), nombre: 'Fin de año', idea: 'mesa de fin de año y brindis' },
  ].sort((x, y) => x.fecha.localeCompare(y.fecha))
}

/** Fechas especiales entre hoy y los próximos `dias` días. */
export function proximasFechas(hoy: string, dias = 30): FechaEspecial[] {
  const a = Number(hoy.slice(0, 4))
  const hasta = sumar(hoy, dias)
  return [...fechasDelAnio(a), ...fechasDelAnio(a + 1)].filter((f) => f.fecha >= hoy && f.fecha <= hasta)
}

/** Estación del año en Argentina. */
export function estacion(fecha: string): string {
  const m = Number(fecha.slice(5, 7))
  return m === 12 || m <= 2 ? 'verano' : m <= 5 ? 'otoño' : m <= 8 ? 'invierno' : 'primavera'
}
