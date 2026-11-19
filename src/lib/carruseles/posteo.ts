// Texto del posteo automático de un carrusel. Puro: lo usan el editor y la pantalla «Publicar» (mismo texto en las dos).
import { enUnaLinea, nombreCorto, textoPosteo, type ContactoTexto, type ProductoTexto } from './textos'
import type { DatosCarrusel, DatosLanzamiento, DatosNutriofertas, DatosRecetas, Id } from './tipos'
import type { EstiloCarrusel } from '@/lib/db/esquema'

export function posteoCarrusel(estilo: EstiloCarrusel, datos: DatosCarrusel, info: Record<number, ProductoTexto | undefined>, contacto: ContactoTexto, hashtags: string[]): string {
  const nombre = (id: Id) => (id != null && info[id] ? nombreCorto(info[id]!) : null)
  const lista = (ids: Id[]) => [...new Set(ids.map(nombre).filter((x): x is string => !!x))]
  if (estilo === 'nutriofertas') {
    const d = datos as DatosNutriofertas
    return textoPosteo('nutriofertas', { titulo: enUnaLinea(d.portada.titulo), productos: lista(d.productos.map((p) => p.id)), contacto, hashtags })
  }
  if (estilo === 'recetas') {
    const d = datos as DatosRecetas
    return textoPosteo('recetas', { titulo: enUnaLinea(d.portada.titulo), bajada: d.ingredientes.bajada, productos: lista(d.ingredientes.items.map((p) => p.id)), contacto, hashtags })
  }
  const d = datos as DatosLanzamiento
  return textoPosteo('lanzamiento', { titulo: enUnaLinea(d.portada.titulo), bajada: d.productos.subtitulo, productos: lista(d.productos.items.map((p) => p.id)).slice(0, 4), contacto, hashtags })
}
