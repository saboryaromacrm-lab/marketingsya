'use server'

import { revalidatePath } from 'next/cache'
import { cancelarPublicacion, crearPublicacion, reintentarPublicacion } from '@/lib/publicaciones/motor'
import { aInstante, type DestinosElegidos, type QuePublicar } from '@/lib/publicaciones/reglas'
import { cuotaInstagram } from '@/lib/meta/conexion'

type Aprobar = {
  tipo: 'carrusel' | 'promo' | 'video'
  id: number
  texto: string
  alt: string | null
  elegidas: number[]
  destinos: DestinosElegidos
  // null = ahora; si no, fecha y hora de Formosa
  programar: { fecha: string; hora: string } | null
  que?: QuePublicar
  redes?: { instagram: boolean; facebook: boolean }
  compartirFeed?: boolean
}

/** Lucas aprobó: se publica ahora o queda programada (programarla ya es la aprobación). */
export async function aprobarPublicacion(a: Aprobar): Promise<{ ok: true; id: number } | { error: string }> {
  if (a.tipo !== 'carrusel' && a.tipo !== 'promo' && a.tipo !== 'video') return { error: 'Pieza desconocida.' }
  let cuando: Date | null = null
  if (a.programar) {
    cuando = aInstante(String(a.programar.fecha ?? ''), String(a.programar.hora ?? ''))
    if (!cuando) return { error: 'Revisá el día y la hora.' }
  }
  const que = (['imagenes', 'reel', 'historiaVideo', 'videoFeed'] as const).find((x) => x === a.que) ?? 'imagenes'
  const r = await crearPublicacion({ tipo: a.tipo, id: Number(a.id), texto: String(a.texto ?? ''), alt: a.alt == null ? null : String(a.alt), elegidas: Array.isArray(a.elegidas) ? a.elegidas : [], destinos: a.destinos, cuando, que, redes: a.redes, compartirFeed: a.compartirFeed !== false })
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
