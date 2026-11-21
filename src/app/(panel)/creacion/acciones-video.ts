'use server'

import { armarVideos, estadoVideos, type TipoPieza } from '@/lib/video/exportar'
import { esFormatoVideo } from '@/lib/video/tipos'

const tipoValido = (t: unknown): t is TipoPieza => t === 'carrusel' || t === 'promo'

export async function accionEstadoVideos(tipo: TipoPieza, id: number) {
  if (!tipoValido(tipo)) return []
  return estadoVideos(tipo, Number(id))
}

export async function accionArmarVideos(tipo: TipoPieza, id: number, formato?: string) {
  if (!tipoValido(tipo)) return { error: 'Pieza desconocida.' }
  return armarVideos(tipo, Number(id), esFormatoVideo(formato) ? formato : undefined)
}
