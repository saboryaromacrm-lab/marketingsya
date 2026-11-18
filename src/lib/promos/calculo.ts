// Cuentas del flyer de promociones. Funciones puras: se prueban sin base ni navegador.
// Recordatorio: las promos solo diseñan, nunca cambian precios en el ERP.

import type { ItemFila, TipoFila } from '@/lib/db/esquema'
import type { ProductoNormalizado } from '@/lib/catalogo/tipos'
import { precioDeLista } from '@/lib/catalogo/precios'

export type ReglaFila = { descuento: number | null; cantidadMinima: number | null; precioFijo: number | null }

const conCentavos = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sinCentavos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** «$ 6.797,45», como en el flyer de ejemplo. */
export const pesosPromo = (n: number) => `$ ${conCentavos.format(n)}`
export const pesosEnteros = (n: number) => `$ ${sinCentavos.format(Math.round(n))}`

/**
 * Precio base de un producto en una lista. En granel se puede pedir un fraccionado («500 g»);
 * si no, el precio por kilo propio o el del fraccionado de 1 kg (ver precioDeLista).
 */
export function precioBase(erp: Pick<ProductoNormalizado, 'precios' | 'presentaciones'>, listaId: number, presentacion?: string | null): number | null {
  if (presentacion) {
    const pr = erp.presentaciones.find((p) => p.tamano === presentacion)
    const x = pr?.precios.find((y) => y.listaId === listaId && y.unidades === 1) ?? pr?.precios.find((y) => y.listaId === listaId)
    if (x) return x.precio
  }
  return precioDeLista(erp, listaId)?.precio ?? null
}

/** Precio promo por unidad: el fijo del ERP si lo hay; si no, el base menos el descuento. Con centavos. */
export function precioPromo(base: number | null, r: ReglaFila): number | null {
  if (r.precioFijo != null) return r.precioFijo
  if (base == null) return null
  const d = Math.min(100, Math.max(0, r.descuento ?? 0))
  return Math.round(base * (1 - d / 100) * 100) / 100
}

/** Texto de la etiqueta verde: «X6 -15%», «-10%», o para el ERP «3 × $ 2.300». */
export function textoOferta(r: ReglaFila): string {
  if (r.precioFijo != null) {
    const n = r.cantidadMinima ?? 1
    return n > 1 ? `${n} × ${pesosEnteros(r.precioFijo * n)}` : 'PROMO'
  }
  const d = r.descuento ?? 0
  const pct = `-${Number.isInteger(d) ? d : conCentavos.format(d)}%`
  return r.cantidadMinima && r.cantidadMinima > 1 ? `X${r.cantidadMinima} ${pct}` : pct
}

// ---------------------------------------------------------------------------
// Nombres cortos: en un grupo, lo que se repite en todos los productos sobra.
// «Pasta de Maní Natural Entrenuts 370 g» / «… Cacao …» → «Natural · x370 g», «Cacao · x370 g»
// ---------------------------------------------------------------------------

const MEDIDA = /(\d+(?:[.,]\d+)?)\s?(g|kg|ml|L|u\.|saquitos|sobres|cápsulas|comprimidos|hojas)\b/i
const normal = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function separarMedida(nombre: string): { nombre: string; tam: string | null } {
  const m = nombre.match(MEDIDA)
  if (!m) return { nombre: nombre.trim(), tam: null }
  return { nombre: (nombre.slice(0, m.index) + nombre.slice(m.index! + m[0].length)).replace(/\s+/g, ' ').trim(), tam: `x${m[1]} ${m[2]}` }
}

export function nombresCortos(nombres: string[]): { nombre: string; tam: string | null }[] {
  const partes = nombres.map(separarMedida)
  if (partes.length < 2) return partes
  const palabras = partes.map((p) => p.nombre.split(' ').filter(Boolean))
  const comunes = new Set(palabras[0].map(normal).filter((w) => palabras.every((ws) => ws.some((x) => normal(x) === w))))
  return partes.map((p, i) => {
    const propias = palabras[i].filter((w) => !comunes.has(normal(w)))
    // Si no queda nada propio (productos casi iguales), se deja el nombre entero
    const corto = propias.join(' ').replace(/^(con|de|y|sin)\s+/i, (m) => m) || p.nombre
    return { nombre: corto.charAt(0).toUpperCase() + corto.slice(1), tam: p.tam }
  })
}

/** Título sugerido para un grupo: las palabras que comparten todos, en su orden («Pasta de Maní Entrenuts»). */
export function tituloComun(nombres: string[]): string {
  const palabras = nombres.map((n) => separarMedida(n).nombre.split(' ').filter(Boolean))
  if (!palabras.length) return ''
  const primera = palabras[0]
  const indices = primera.map((w, i) => (palabras.every((ws) => ws.some((x) => normal(x) === normal(w))) ? i : -1)).filter((i) => i >= 0)
  // Un conector («de», «con», «y») queda solo si une dos palabras que iban seguidas:
  // «Pasta de Maní» sí; en «Semillas de [Chía] Cumana» el «de» ya no une nada.
  const conectores = /^(de|del|con|y|sin|la|el|en)$/i
  const elegidas = indices.filter((i) => !conectores.test(primera[i]) || (indices.includes(i - 1) && indices.includes(i + 1)))
  return elegidas.map((i) => primera[i]).join(' ')
}

// ---------------------------------------------------------------------------
// Paginación: qué filas van en cada placa. Las alturas son fijas en el CSS del flyer (flyer.ts),
// así el cálculo es exacto y nada queda tapado por el pie.
// ---------------------------------------------------------------------------

export type Formato = 'historia' | 'feed' | 'uno'
export const MEDIDAS = { historia: { ancho: 1080, alto: 1920 }, feed: { ancho: 1080, alto: 1350 }, uno: { ancho: 1080, alto: 1350 } } as const
export const ALTO = {
  cabeza: { '1': 272, '2': 300 },
  pie: 104,
  margenInferior: 16,
  separacion: 18,
  fila: 226, // producto o variantes (borde incluido)
  grupoBase: 68, // espacio arriba (pestaña) y abajo del grupo
  grupoLinea: 262, // una línea de hasta 4 productos
  grupoEntreLineas: 14,
  grupoPrimero: 26, // si un grupo abre la placa, baja un poco para que su pestaña no pise la fecha
}
export const POR_LINEA = 4

/** Un bloque es lo que se dibuja de corrido: una fila entera, o algunas líneas de un grupo largo. */
export type Bloque = { fila: number; desde: number; hasta: number } // productos [desde, hasta) de la fila

const altoGrupo = (lineas: number) => ALTO.grupoBase + lineas * ALTO.grupoLinea + (lineas - 1) * ALTO.grupoEntreLineas

export function paginar(filas: { tipo: TipoFila; productos: ItemFila[] }[], formato: 'historia' | 'feed', diseno: '1' | '2'): Bloque[][] {
  const disponible = MEDIDAS[formato].alto - ALTO.cabeza[diseno] - ALTO.pie - ALTO.margenInferior
  const paginas: Bloque[][] = []
  let actual: Bloque[] = []
  let usado = 0
  const cerrar = () => {
    if (actual.length) paginas.push(actual)
    actual = []
    usado = 0
  }
  const poner = (b: Bloque, alto: number, grupo: boolean) => {
    const extra = (n: number) => (n ? ALTO.separacion : grupo ? ALTO.grupoPrimero : 0)
    if (usado + extra(actual.length) + alto > disponible) cerrar()
    usado += extra(actual.length) + alto
    actual.push(b)
  }
  filas.forEach((f, i) => {
    if (f.tipo !== 'grupo') return poner({ fila: i, desde: 0, hasta: f.productos.length }, ALTO.fila, false)
    // Grupo: entra entero si se puede; si no, se parte por líneas de 4 (el título se repite).
    const lineas = Math.ceil(f.productos.length / POR_LINEA)
    const maxLineas = Math.max(1, Math.floor((disponible - ALTO.grupoPrimero - ALTO.grupoBase + ALTO.grupoEntreLineas) / (ALTO.grupoLinea + ALTO.grupoEntreLineas)))
    for (let l = 0; l < lineas; l += maxLineas) {
      const n = Math.min(maxLineas, lineas - l)
      poner({ fila: i, desde: l * POR_LINEA, hasta: Math.min(f.productos.length, (l + n) * POR_LINEA) }, altoGrupo(n), true)
    }
  })
  cerrar()
  return paginas
}

/**
 * Cómo repartir el espacio que sobra en una placa con pocos productos: un poco más de aire entre filas
 * (hasta 56 px) y el resto mitad arriba, mitad abajo, así no queda un hueco blanco al pie.
 */
export function aireDePlaca(altos: number[], primeroEsGrupo: boolean, formato: 'historia' | 'feed', diseno: '1' | '2') {
  const disponible = MEDIDAS[formato].alto - ALTO.cabeza[diseno] - ALTO.pie - ALTO.margenInferior
  const usado = altos.reduce((a, b) => a + b, 0) + ALTO.separacion * Math.max(0, altos.length - 1) + (primeroEsGrupo ? ALTO.grupoPrimero : 0)
  const libre = Math.max(0, disponible - usado)
  if (!altos.length) return { arriba: 0, entre: ALTO.separacion }
  const extra = Math.min(56, libre / (altos.length + 1))
  return { arriba: Math.round(extra + (libre - extra * (altos.length + 1)) / 2), entre: Math.round(ALTO.separacion + extra) }
}
