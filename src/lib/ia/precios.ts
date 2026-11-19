// Precios de la API de Claude (USD por millón de tokens), para el contador de gasto.
// Fuente: tabla de precios de Anthropic (noviembre de 2026). Escritura de caché: 1,25 × entrada.

import type { ModeloIA } from '@/lib/configuracion-tipos'

export const PRECIOS: Record<ModeloIA, { entrada: number; salida: number; cacheLectura: number }> = {
  'claude-opus-5-5': { entrada: 4, salida: 20, cacheLectura: 0.2 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10, cacheLectura: 0.1 },
  'claude-haiku-5-5': { entrada: 0.1, salida: 0.5, cacheLectura: 0.01 },
}

export type Uso = { entrada: number; salida: number; cacheLectura: number; cacheEscritura: number }

export function costo(modelo: string, u: Uso): number {
  // Si respondió otro modelo (respaldo ante un rechazo), se cobra al precio de Opus 5.5 por las dudas
  const p = PRECIOS[modelo as ModeloIA] ?? PRECIOS['claude-opus-5-5']
  return (u.entrada * p.entrada + u.salida * p.salida + u.cacheLectura * p.cacheLectura + u.cacheEscritura * p.entrada * 1.25) / 1_000_000
}

// Tokens típicos de cada pedido, para mostrar cuánto sale aproximadamente antes de apretar
const TIPICO: Record<TipoPedido, Uso> = {
  sugerencias: { entrada: 12000, salida: 3000, cacheLectura: 0, cacheEscritura: 0 },
  semana: { entrada: 12000, salida: 4000, cacheLectura: 0, cacheEscritura: 0 },
  receta: { entrada: 10000, salida: 3000, cacheLectura: 0, cacheEscritura: 0 },
  texto: { entrada: 1500, salida: 700, cacheLectura: 0, cacheEscritura: 0 },
  chat: { entrada: 4000, salida: 1200, cacheLectura: 0, cacheEscritura: 0 },
}
export type TipoPedido = 'sugerencias' | 'semana' | 'receta' | 'texto' | 'chat'
export const costoEstimado = (modelo: ModeloIA, tipo: TipoPedido) => costo(modelo, TIPICO[tipo])

export const dolares = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const aprox = (n: number) => `≈ ${n < 0.01 ? 'US$ 0,01' : dolares(n)}`
