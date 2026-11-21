import Link from 'next/link'
import { desc, inArray, sql } from 'drizzle-orm'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { db, esquema } from '@/lib/db'
import { cuando } from '@/lib/formato'
import { urlMedia } from '@/lib/media'
import { ESTILOS } from '@/lib/carruseles/tipos'
import { limpiarFormatosCarrusel } from '@/lib/video/tipos'
import { textoVigencia } from '@/lib/promos/fechas'
import { MenuCreacion } from '../MenuCreacion'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mis piezas' }

const { carruseles, promos, exportaciones, publicaciones, piezasVideo, videos: biblioteca } = esquema

const VER = { todas: 'Todas', carruseles: 'Carruseles', historias: 'Historias', reels: 'Reels', promos: 'Promos', videos: 'Videos propios' } as const
type Ver = keyof typeof VER
const ESTADOS = { todos: 'Cualquier estado', borrador: 'Borrador', lista: 'Lista', programada: 'Programada', publicada: 'Publicada' } as const
type Estado = Exclude<keyof typeof ESTADOS, 'todos'>
const CLASE: Record<Estado, string> = { borrador: 'chip-en_cola', lista: '', programada: 'chip-en_cola', publicada: 'chip-ok' }

type Pieza = { tipo: 'carrusel' | 'promo' | 'video'; id: number; titulo: string; detalle: string; formatos: string[]; historia: boolean; reel: boolean; actualizado: Date; exportacionId: number | null; miniatura?: string | null }

export default async function MisPiezas({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string; estado?: string }> }) {
  const q = await searchParams
  const ver: Ver = q.ver && q.ver in VER ? (q.ver as Ver) : 'todas'
  const estadoFiltro = q.estado && q.estado in ESTADOS && q.estado !== 'todos' ? (q.estado as Estado) : null
  const buscar = (q.q ?? '').trim().toLowerCase()
  const [cs, ps, pubs, vs] = await Promise.all([
    db.select().from(carruseles).orderBy(desc(carruseles.actualizadoEn)).limit(200),
    db.select().from(promos).orderBy(desc(promos.actualizadoEn)).limit(200),
    db.select({ tipo: publicaciones.tipo, ref: publicaciones.referenciaId, estado: publicaciones.estado }).from(publicaciones),
    db.select().from(piezasVideo).orderBy(desc(piezasVideo.actualizadoEn)).limit(200),
  ])
  // Videos propios: de miniatura, la del primer clip (hasta que haya un video armado)
  const primeros = [...new Set(vs.map((v) => v.contenido.clips?.[0]?.videoId).filter((x): x is number => Number.isInteger(x)))]
  const minis = primeros.length ? await db.select({ id: biblioteca.id, miniatura: biblioteca.miniatura }).from(biblioteca).where(inArray(biblioteca.id, primeros)) : []
  const piezas: Pieza[] = [
    ...cs.map((c): Pieza => {
      const f = limpiarFormatosCarrusel(c.formatos)
      return {
        tipo: 'carrusel', id: c.id, titulo: c.titulo, detalle: ESTILOS[c.estilo].nombre, actualizado: c.actualizadoEn, exportacionId: c.exportacionId,
        formatos: [f.carrusel && 'Carrusel', f.historia && 'Historia', f.reel && 'Reel', f.historiaVideo && 'Historia en video', f.videoFeed && 'Video de feed'].filter((x): x is string => !!x),
        historia: f.historia || f.historiaVideo, reel: f.reel,
      }
    }),
    ...ps.map((p): Pieza => ({
      tipo: 'promo', id: p.id, titulo: p.titulo, detalle: textoVigencia(p.desde, p.hasta).toLowerCase(), actualizado: p.actualizadoEn, exportacionId: p.exportacionId,
      formatos: [p.formatos.historia && 'Historia', p.formatos.feed && 'Feed', p.formatos.uno && 'Uno por producto', p.formatos.reel && 'Reel', p.formatos.historiaVideo && 'Historia en video', p.formatos.videoFeed && 'Video de feed'].filter((x): x is string => !!x),
      historia: !!p.formatos.historia || !!p.formatos.historiaVideo, reel: !!p.formatos.reel,
    })),
    ...vs.map((v): Pieza => {
      const f = v.formatos
      const mini = minis.find((m) => m.id === v.contenido.clips?.[0]?.videoId)?.miniatura
      return {
        tipo: 'video', id: v.id, titulo: v.titulo, detalle: `${v.contenido.clips?.length ?? 0} ${v.contenido.clips?.length === 1 ? 'clip' : 'clips'}`, actualizado: v.actualizadoEn, exportacionId: null,
        formatos: [f.reel && 'Reel', f.historiaVideo && 'Historia en video', f.videoFeed && 'Video de feed'].filter((x): x is string => !!x),
        historia: !!f.historiaVideo, reel: !!f.reel, miniatura: mini ? urlMedia(mini) : null,
      }
    }),
  ].sort((a, b) => b.actualizado.getTime() - a.actualizado.getTime())

  const expIds = piezas.map((p) => p.exportacionId).filter((x): x is number => x != null)
  const exps = expIds.length ? await db.select({ id: exportaciones.id, estado: exportaciones.estado, archivos: exportaciones.archivos }).from(exportaciones).where(inArray(exportaciones.id, expIds)) : []
  // Si no hay imágenes exportadas, la miniatura es la portada del último video armado
  const videos = await db.select({ tipo: exportaciones.tipo, ref: exportaciones.referenciaId, archivos: exportaciones.archivos }).from(exportaciones).where(sql`${exportaciones.formato} is not null and ${exportaciones.estado} = 'ok'`).orderBy(desc(exportaciones.id)).limit(400)
  const estadoDe = (p: Pieza): Estado => {
    const mias = pubs.filter((x) => x.tipo === p.tipo && x.ref === p.id)
    if (mias.some((x) => x.estado === 'publicada' || x.estado === 'parcial')) return 'publicada'
    if (mias.some((x) => x.estado === 'programada' || x.estado === 'reintentando' || x.estado === 'publicando')) return 'programada'
    return exps.find((e) => e.id === p.exportacionId)?.estado === 'ok' || videos.some((v) => v.tipo === p.tipo && v.ref === p.id) ? 'lista' : 'borrador'
  }
  const miniatura = (p: Pieza) => {
    const a = exps.find((e) => e.id === p.exportacionId && e.estado === 'ok')?.archivos.find((x) => !x.endsWith('.mp4'))
    const v = videos.find((x) => x.tipo === p.tipo && x.ref === p.id)?.archivos[1]
    return a ? urlMedia(a) : v ? urlMedia(v) : p.miniatura ?? null
  }
  const pasaVer = (p: Pieza, v: Ver) => v === 'todas' || (v === 'carruseles' && p.tipo === 'carrusel') || (v === 'promos' && p.tipo === 'promo') || (v === 'historias' && p.historia) || (v === 'reels' && p.reel) || (v === 'videos' && p.tipo === 'video')
  const conBusqueda = piezas.filter((p) => !buscar || p.titulo.toLowerCase().includes(buscar)).map((p) => ({ ...p, estado: estadoDe(p) })).filter((p) => !estadoFiltro || p.estado === estadoFiltro)
  const lista = conBusqueda.filter((p) => pasaVer(p, ver))
  const enlace = (v: Ver) => `/creacion/piezas?${new URLSearchParams({ ...(v !== 'todas' ? { ver: v } : {}), ...(q.q ? { q: q.q } : {}), ...(estadoFiltro ? { estado: estadoFiltro } : {}) })}`

  return (
    <>
      <Cabecera titulo="Creación" subtitulo="Todo lo que armaste, en un solo lugar." miga={[{ texto: 'Creación', href: '/creacion' }, { texto: 'Mis piezas' }]} />
      <div className="dos-columnas">
        <MenuCreacion />
        <div className="columna-principal">
          <form className="filtros-piezas" action="/creacion/piezas">
            {ver !== 'todas' && <input type="hidden" name="ver" value={ver} />}
            <input className="input" name="q" defaultValue={q.q ?? ''} placeholder="Buscar por nombre…" aria-label="Buscar" />
            <select className="input" name="estado" defaultValue={estadoFiltro ?? 'todos'} aria-label="Estado">
              {Object.entries(ESTADOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            <button className="btn" type="submit"><Icono nombre="search" />Filtrar</button>
          </form>
          <nav className="pestanas" aria-label="Formato">
            {(Object.keys(VER) as Ver[]).map((k) => <Link key={k} href={enlace(k)} className={ver === k ? 'pestana-activa' : ''}>{VER[k]} ({conBusqueda.filter((p) => pasaVer(p, k)).length})</Link>)}
          </nav>
          {lista.length ? (
            <div className="grilla-piezas">
              {lista.map((p) => {
                const img = miniatura(p)
                const editar = p.tipo === 'carrusel' ? `/carruseles/${p.id}` : p.tipo === 'promo' ? `/promos/${p.id}` : `/creacion/videos/${p.id}`
                return (
                  <article key={`${p.tipo}-${p.id}`} className="tarjeta-pieza">
                    <Link href={editar} className="tarjeta-pieza-imagen">
                      {img ? <img src={img} alt="" loading="lazy" /> : <span className="tarjeta-pieza-vacia"><Icono nombre={p.tipo === 'promo' ? 'sell' : p.tipo === 'video' ? 'videocam' : 'view_carousel'} tamano={36} /></span>}
                      {p.reel && <span className="tarjeta-pieza-video"><Icono nombre="play_arrow" tamano={14} />Reel</span>}
                    </Link>
                    <div className="tarjeta-pieza-cuerpo">
                      <Link href={editar}><b>{p.titulo}</b></Link>
                      <span className="texto-chico">{p.tipo === 'carrusel' ? 'Carrusel' : p.tipo === 'promo' ? 'Promo' : 'Video propio'} · {p.detalle}</span>
                      <div className="chips">{p.formatos.map((f) => <span key={f} className="chip chip-mini">{f}</span>)}</div>
                      <div className="fila-separada">
                        <span className={`chip ${CLASE[p.estado]}`}>{ESTADOS[p.estado].toUpperCase()}</span>
                        <span className="texto-chico">{cuando(p.actualizado)}</span>
                      </div>
                      <div className="fila-chips">
                        <Link className="btn btn-chico" href={editar}><Icono nombre="edit" tamano={16} />Editar</Link>
                        <Link className="btn btn-chico" href={`/publicaciones/nueva?${p.tipo}=${p.id}`}><Icono nombre="send" tamano={16} />Publicar</Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="vacio"><b>No hay piezas acá.</b> Armá una nueva desde <Link href="/creacion">Nueva pieza</Link>.</div>
          )}
        </div>
      </div>
    </>
  )
}
