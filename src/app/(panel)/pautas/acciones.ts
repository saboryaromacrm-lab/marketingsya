'use server'

import { revalidatePath } from 'next/cache'
import { accionPauta, cambiarPresupuesto, crearPauta, sincronizarPautas, type NuevaPauta } from '@/lib/pautas/motor'
import { sugerirPauta, type SugerenciaPauta } from '@/lib/pautas/ia'
import { ErrorIA } from '@/lib/ia/claude'

const refrescar = () => { revalidatePath('/pautas'); revalidatePath('/') }

export async function lanzarPauta(n: NuevaPauta) {
  const r = await crearPauta(n)
  refrescar()
  return r
}

export async function actualizarPautas(forzar: boolean) {
  const r = await sincronizarPautas(!!forzar)
  if (r.actualizadas) refrescar()
  return r
}

export async function pausar(id: number) { const r = await accionPauta(Number(id), 'pausar'); refrescar(); return r }
export async function reanudar(id: number) { const r = await accionPauta(Number(id), 'reanudar'); refrescar(); return r }
export async function terminar(id: number) { const r = await accionPauta(Number(id), 'terminar'); refrescar(); return r }

export async function nuevoPresupuesto(id: number, porDia: number, hasta: string, confirmado: number) {
  const r = await cambiarPresupuesto(Number(id), Number(porDia), String(hasta), Number(confirmado))
  refrescar()
  return r
}

/** La IA mira cómo les fue a los posteos y propone cuál pautar y con cuánto. */
export async function pedirSugerencia(): Promise<{ ok: true; sugerencia: SugerenciaPauta } | { error: string }> {
  try {
    const s = await sugerirPauta()
    return { ok: true, sugerencia: s }
  } catch (e) {
    if (e instanceof ErrorIA) return { error: e.message }
    console.error('[pautas ia]', e)
    return { error: 'Algo falló al pedir la sugerencia. Probá de nuevo en un rato.' }
  }
}
