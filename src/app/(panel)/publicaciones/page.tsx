import Link from 'next/link'
import { piezasExistentes } from '@/lib/creacion/borrar'
import { desc, inArray, sql } from 'drizzle-orm'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { db, esquema } from '@/lib/db'
import type { EstadoPublicacion } from '@/lib/db/esquema'
import { cuando } from '@/lib/formato'
import { urlMedia } from '@/lib/media'
import { estadoMeta } from '@/lib/meta/conexion'
import { NOMBRE_QUE, textoCuando, type QuePublicar } from '@/lib/publicaciones/reglas'
import { ListaPublicaciones, type FilaPublicacion } from './ListaPublicaciones'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Publicaciones' }

const { publicaciones, publicacionDestinos, exportaciones } = esquema

const PESTANAS = {
  todas: { texto: 'Todas', estados: null },
  programadas: { texto: 'Programadas', estados: ['programada', 'publicando', 'reintentando'] },
  publicadas: { texto: 'Publicadas', estados: ['publicada'] },
  error: { texto: 'Con error', estados: ['error', 'parcial'] },
} as const satisfies Record<string, { texto: string; estados: readonly EstadoPublicacion[] | null }>
type Pestana = keyof typeof PESTANAS

const EN_CURSO: EstadoPublicacion[] = ['programada', 'publicando', 'reintentando']

export default async function Publicaciones({ searchParams }: { searchParams: Promise<{ ver?: string; nueva?: string }> }) {
  const q = await searchParams
  const ver: Pestana = q.ver && q.ver in PESTANAS ? (q.ver as Pestana) : 'todas'
  const filtro = PESTANAS[ver].estados
  const [filas, conteos, meta] = await Promise.all([
    db.select().from(publicaciones).where(filtro ? inArray(publicaciones.estado, [...filtro]) : undefined).orderBy(desc(publicaciones.programadaPara)).limit(150),
    db.select({ estado: publicaciones.estado, n: sql<number>`count(*)::int` }).from(publicaciones).groupBy(publicaciones.estado),
    estadoMeta(),
  ])
  const ids = filas.map((f) => f.id)
  const expIds = [...new Set(filas.map((f) => f.exportacionId).filter((x): x is number => x != null))]
  const [destinos, exps] = await Promise.all([
    ids.length ? db.select().from(publicacionDestinos).where(inArray(publicacionDestinos.publicacionId, ids)).orderBy(publicacionDestinos.id) : [],
    expIds.length ? db.select({ id: exportaciones.id, archivos: exportaciones.archivos }).from(exportaciones).where(inArray(exportaciones.id, expIds)) : [],
  ])
  const archivos = new Map(exps.map((e) => [e.id, e.archivos]))
  // Las piezas borradas siguen en el historial, sin enlace
  const existen = await piezasExistentes(filas.map((f) => ({ tipo: f.tipo, id: f.referenciaId })))
  const cuenta = (estados: readonly EstadoPublicacion[] | null) => conteos.filter((c) => !estados || estados.includes(c.estado)).reduce((s, c) => s + c.n, 0)

  // Lo que viene primero (lo más próximo arriba); después lo terminado, lo más nuevo arriba
  const ordenadas = [...filas.filter((f) => EN_CURSO.includes(f.estado)).sort((a, b) => a.programadaPara.getTime() - b.programadaPara.getTime()), ...filas.filter((f) => !EN_CURSO.includes(f.estado))]
  const ahora = new Date()
  const lista: FilaPublicacion[] = ordenadas.map((p) => {
    const ds = destinos.filter((d) => d.publicacionId === p.id)
    const arch = p.exportacionId ? archivos.get(p.exportacionId) : undefined
    // Videos: la miniatura es la portada (el segundo archivo)
    const primera = p.formato !== 'imagenes' ? 1 : ds[0]?.placas[0] ?? 0
    const feed = ds.find((d) => d.ubicacion === 'feed')
    const historias = new Set(ds.filter((d) => d.ubicacion === 'historia').flatMap((d) => d.placas)).size
    return {
      id: p.id,
      titulo: p.titulo,
      detalle: p.formato !== 'imagenes'
        ? [p.tipo === 'carrusel' ? 'Carrusel' : p.tipo === 'promo' ? 'Promo' : 'Video propio', NOMBRE_QUE[p.formato as QuePublicar] ?? 'Video'].join(' · ')
        : [p.tipo === 'carrusel' ? 'Carrusel' : p.tipo === 'promo' ? 'Promo' : 'Video propio', feed ? `${feed.placas.length} ${feed.placas.length === 1 ? 'imagen' : 'imágenes'}` : null, historias ? `${historias} ${historias === 1 ? 'historia' : 'historias'}` : null].filter(Boolean).join(' · '),
      pieza: !existen.has(`${p.tipo}-${p.referenciaId}`) ? null : p.tipo === 'carrusel' ? `/carruseles/${p.referenciaId}` : p.tipo === 'promo' ? `/promos/${p.referenciaId}` : `/creacion/videos/${p.referenciaId}`,
      miniatura: arch?.[primera] ? urlMedia(arch[primera]) : null,
      estado: p.estado,
      cuando: EN_CURSO.includes(p.estado) ? textoCuando(p.proximoIntento ?? p.programadaPara, ahora) : cuando(p.terminadoEn ?? p.programadaPara, ahora),
      destinos: ds.map((d) => ({ red: d.red, ubicacion: d.ubicacion, estado: d.estado, error: d.error, enlace: d.enlace })),
    }
  })
  const recientesConError = filas.filter((f) => (f.estado === 'error' || f.estado === 'parcial') && f.terminadoEn && ahora.getTime() - f.terminadoEn.getTime() < 7 * 864e5)
  const tokenMal = destinos.some((d) => d.estado === 'error' && d.error?.includes('token'))

  return (
    <div className="contenido">
      <Cabecera titulo="Publicaciones" subtitulo="Lo programado, lo publicado y lo que falló en Instagram y Facebook." miga={[{ texto: 'Publicaciones' }]} />
      {!meta.conectada && (
        <Aviso tono="ambar" dato="Meta todavía no está conectado:" accion={<Link className="btn btn-chico" href="/configuracion/meta">Conectar</Link>}>
          cargá el token en Configuración › Meta para poder publicar.
        </Aviso>
      )}
      {recientesConError.length > 0 && ver !== 'error' && (
        <Aviso tono="ambar" dato={`${recientesConError.length === 1 ? '1 publicación falló' : `${recientesConError.length} publicaciones fallaron`} en los últimos días:`} accion={tokenMal ? <Link className="btn btn-chico" href="/configuracion/meta">Revisar la conexión</Link> : <Link className="btn btn-chico" href="/publicaciones?ver=error">Ver</Link>}>
          «{recientesConError[0].titulo}».
        </Aviso>
      )}
      <nav className="pestanas" aria-label="Filtrar">
        {(Object.keys(PESTANAS) as Pestana[]).map((k) => (
          <Link key={k} href={k === 'todas' ? '/publicaciones' : `/publicaciones?ver=${k}`} className={ver === k ? 'pestana-activa' : ''}>{PESTANAS[k].texto} ({cuenta(PESTANAS[k].estados)})</Link>
        ))}
      </nav>
      <ListaPublicaciones filas={lista} nueva={Number(q.nueva) || null} />
      <p className="texto-chico">
        Para publicar, abrí un carrusel o una promo y tocá «Publicar». Instagram no deja borrar publicaciones desde aplicaciones externas: eso se hace desde la app.
      </p>
    </div>
  )
}
