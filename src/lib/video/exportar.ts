import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cargarCarrusel, formatosDe } from '@/lib/carruseles/datos'
import { idsDe } from '@/lib/carruseles/tipos'
import { cargarPromo } from '@/lib/promos/datos'
import { encolarExportacion } from '@/lib/piezas/exportar'
import { urlMedia } from '@/lib/media'
import { leerConfig } from '@/lib/configuracion'
import { ANIMACION_INICIAL, FORMATOS_VIDEO, limpiarAnimacion, videosDe, type FormatoVideo } from './tipos'
import { videoDe } from './piezas'

const { exportaciones } = esquema

export type TipoPieza = 'carrusel' | 'promo' | 'video'

/** Dirección del video (la música y el segundo de la portada van en la dirección: la firma los cubre). */
export const rutaVideo = (tipo: Exclude<TipoPieza, 'video'>, id: number, formato: FormatoVideo, musicaId: number | null, portada: number) =>
  `/render/video/${tipo}/${id}?formato=${formato}${musicaId ? `&musica=${musicaId}` : ''}&portada=${portada}`

type Pieza = { formatos: FormatoVideo[]; sinFoto: string[]; animacion: ReturnType<typeof limpiarAnimacion> }

async function pieza(tipo: Exclude<TipoPieza, 'video'>, id: number): Promise<Pieza | null> {
  const config = await leerConfig()
  const base = { ...ANIMACION_INICIAL, ...config.creacion.animacion }
  if (tipo === 'carrusel') {
    const c = await cargarCarrusel(id)
    if (!c) return null
    const prods = idsDe(c.carrusel.estilo, c.datos).map((x) => c.productos.get(x)).filter((p) => !!p)
    return { formatos: videosDe(formatosDe(c)), sinFoto: [...new Set(prods.filter((p) => !p.foto).map((p) => p.nombre))], animacion: limpiarAnimacion(c.carrusel.animacion, base) }
  }
  const d = await cargarPromo(id)
  if (!d) return null
  return { formatos: videosDe(d.promo.formatos), sinFoto: [...d.productos.values()].filter((p) => !p.foto).map((p) => p.nombre), animacion: limpiarAnimacion(d.promo.animacion, base) }
}

export type EstadoVideo = {
  formato: FormatoVideo
  nombre: string
  total: number
  omitidas: number
  alDia: boolean
  exportacion: { id: number; estado: string; avance: number; video: string | null; portada: string | null; error: string | null } | null
}

/** Cada video marcado en la pieza: su último armado y si sigue al día con la pieza. */
export async function estadoVideos(tipo: TipoPieza, id: number): Promise<EstadoVideo[]> {
  if (tipo === 'video') return (await import('./propios/armar')).estadoVideosPropio(id)
  const p = await pieza(tipo, id)
  if (!p) return []
  const r: EstadoVideo[] = []
  for (const formato of p.formatos) {
    const [v, [x]] = await Promise.all([
      videoDe(tipo, id, formato),
      db.select().from(exportaciones).where(and(eq(exportaciones.tipo, tipo), eq(exportaciones.referenciaId, id), eq(exportaciones.formato, formato))).orderBy(desc(exportaciones.id)).limit(1),
    ])
    r.push({
      formato, nombre: FORMATOS_VIDEO[formato].nombre, total: v?.total ?? 0, omitidas: v?.omitidas ?? 0,
      alDia: !!x && x.estado === 'ok' && x.huella === v?.huella,
      exportacion: x ? { id: x.id, estado: x.estado, avance: x.avance, video: x.archivos[0] ? urlMedia(x.archivos[0]) : null, portada: x.archivos[1] ? urlMedia(x.archivos[1]) : null, error: x.error } : null,
    })
  }
  return r
}

/** Arma los videos marcados que no estén al día (o el que se pida). Devuelve el id de cada exportación. */
export async function armarVideos(tipo: TipoPieza, id: number, solo?: FormatoVideo): Promise<{ ok: true; exportaciones: { formato: FormatoVideo; id: number }[] } | { error: string }> {
  if (tipo === 'video') return (await import('./propios/armar')).armarVideosPropio(id, solo)
  const p = await pieza(tipo, id)
  if (!p) return { error: 'Esa pieza ya no existe.' }
  if (p.sinFoto.length) return { error: `No se puede armar el video: ${p.sinFoto.map((x) => `«${x}»`).join(', ')} sin foto.` }
  const formatos = solo ? p.formatos.filter((f) => f === solo) : p.formatos
  if (!formatos.length) return { error: 'Marcá algún formato de video (reel, historia en video o video de feed).' }
  const estados = await estadoVideos(tipo, id)
  const hechos: { formato: FormatoVideo; id: number }[] = []
  for (const formato of formatos) {
    const est = estados.find((e) => e.formato === formato)
    if (est?.alDia && est.exportacion) { hechos.push({ formato, id: est.exportacion.id }); continue }
    if (est?.exportacion && (est.exportacion.estado === 'en_cola' || est.exportacion.estado === 'corriendo')) { hechos.push({ formato, id: est.exportacion.id }); continue }
    const v = await videoDe(tipo, id, formato)
    if (!v) continue
    const expId = await encolarExportacion(tipo, [rutaVideo(tipo, id, formato, v.musicaId, v.portada)], id, v.huella, formato)
    hechos.push({ formato, id: expId })
  }
  return { ok: true, exportaciones: hechos }
}

/** La exportación al día de un video (o la arma). Para publicar. */
export async function videoAlDia(tipo: TipoPieza, id: number, formato: FormatoVideo): Promise<number | null> {
  const r = await armarVideos(tipo, id, formato)
  return 'error' in r ? null : r.exportaciones.find((x) => x.formato === formato)?.id ?? null
}
