'use server'

import { revalidatePath } from 'next/cache'
import { cancelarPublicacion, crearPublicacion, reintentarPublicacion } from '@/lib/publicaciones/motor'
import { aInstante, type DestinosElegidos } from '@/lib/publicaciones/reglas'
import { cuotaInstagram } from '@/lib/meta/conexion'

type Aprobar = {
  tipo: 'carrusel' | 'promo'
  id: number
  texto: string
  alt: string | null
  elegidas: number[]
  destinos: DestinosElegidos
  // null = ahora; si no, fecha y hora de Formosa
  programar: { fecha: string; hora: string } | null
}

/** Lucas aprobó: se publica ahora o queda programada (programarla ya es la aprobación). */
export async function aprobarPublicacion(a: Aprobar): Promise<{ ok: true; id: number } | { error: string }> {
  if (a.tipo !== 'carrusel' && a.tipo !== 'promo') return { error: 'Pieza desconocida.' }
  let cuando: Date | null = null
  if (a.programar) {
    cuando = aInstante(String(a.programar.fecha ?? ''), String(a.programar.hora ?? ''))
    if (!cuando) return { error: 'Revisá el día y la hora.' }
  }
  const r = await crearPublicacion({ tipo: a.tipo, id: Number(a.id), texto: String(a.texto ?? ''), alt: a.alt == null ? null : String(a.alt), elegidas: a.elegidas, destinos: a.destinos, cuando })
  if ('error' in r) return r
  revalidatePath('/publicaciones')
  revalidatePath('/')
  return { ok: true, id: r.id }
}

export async function cancelar(id: number) {
  const r = await cancelarPublicacion(Number(id))
  revalidatePath('/publicaciones')
  revalidatePath('/')
  return r
}

export async function reintentar(id: number) {
  const r = await reintentarPublicacion(Number(id))
  revalidatePath('/publicaciones')
  revalidatePath('/')
  return r
}

export async function cuotaHoy() {
  return cuotaInstagram()
}
