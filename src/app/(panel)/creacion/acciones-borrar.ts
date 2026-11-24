'use server'

import { revalidatePath } from 'next/cache'
import { borrarPieza } from '@/lib/creacion/borrar'
import type { TipoPieza } from '@/lib/creacion/borrar-reglas'

export type PiezaFrenada = { tipo: TipoPieza; id: number; titulo: string; motivo: string; enlace: string | null }

const TIPOS: readonly TipoPieza[] = ['carrusel', 'promo', 'video']

/** Borra varias piezas de una (desde Mis piezas). Las que no se pueden, vuelven con el motivo. */
export async function accionBorrarPiezas(lista: { tipo: TipoPieza; id: number }[]): Promise<{ borradas: number; frenadas: PiezaFrenada[] }> {
  let borradas = 0
  const frenadas: PiezaFrenada[] = []
  for (const p of lista.slice(0, 300)) {
    if (!TIPOS.includes(p.tipo) || !Number.isInteger(p.id)) continue
    const r = await borrarPieza(p.tipo, p.id)
    if (r.ok) borradas++
    else frenadas.push({ tipo: p.tipo, id: p.id, titulo: r.titulo, motivo: r.motivo, enlace: r.enlace })
  }
  revalidatePath('/creacion/piezas')
  revalidatePath('/carruseles')
  revalidatePath('/promos')
  return { borradas, frenadas }
}
