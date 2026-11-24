import Link from 'next/link'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import { db, esquema } from '@/lib/db'
import type { EstadoPauta } from '@/lib/db/esquema'
import { leerConfig } from '@/lib/configuracion'
import { OBJETIVOS_PAUTA, type ObjetivoPauta } from '@/lib/configuracion-tipos'
import { cuando } from '@/lib/formato'
import { urlMedia } from '@/lib/media'
import { estadoMeta } from '@/lib/meta/conexion'
import { estadoIA } from '@/lib/ia/claude'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { disponibilidad } from '@/lib/ia/disponibilidad'
import { hoyFormosa } from '@/lib/promos/fechas'
import { leerPublicidad, topeDelMes, ultimaSincronizacion } from '@/lib/pautas/motor'
import { pesos, resultadoPrincipal } from '@/lib/pautas/reglas'
import { ListaPautas, type FilaPauta } from './ListaPautas'
import { SugerenciaIA } from './SugerenciaIA'

export const dynamic = 'force-dynamic'
// Siempre al día al volver: lo que muestra cambia solo o desde otra pantalla (no se reusa lo visto, ver staleTimes en next.config)
export const unstable_dynamicStaleTime = 0
export const metadata = { title: 'Pautas' }

const { pautas, publicaciones, publicacionDestinos, exportaciones } = esquema

const PESTANAS = {
  todas: { texto: 'Todas', estados: null },
  activas: { texto: 'Activas', estados: ['activa', 'programada', 'pausada'] },
  revision: { texto: 'En revisión', estados: ['creando', 'en_revision'] },
  terminadas: { texto: 'Terminadas', estados: ['terminada'] },
  rechazadas: { texto: 'Rechazadas', estados: ['rechazada', 'con_problemas', 'error'] },
} as const satisfies Record<string, { texto: string; estados: readonly EstadoPauta[] | null }>
type Pestana = keyof typeof PESTANAS

const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

export default async function Pautas({ searchParams }: { searchParams: Promise<{ ver?: string; nueva?: string }> }) {
  const q = await searchParams
  const ver: Pestana = q.ver && q.ver in PESTANAS ? (q.ver as Pestana) : 'todas'
  const filtro = PESTANAS[ver].estados
  const config = await leerConfig()
  const [filas, conteos, meta, publicidad, tope, sinc, ia, recientes] = await Promise.all([
    db.select().from(pautas).where(filtro ? inArray(pautas.estado, [...filtro]) : undefined).orderBy(desc(pautas.id)).limit(150),
    db.select({ estado: pautas.estado, n: sql<number>`count(*)::int` }).from(pautas).groupBy(pautas.estado),
    estadoMeta(),
    leerPublicidad(),
    topeDelMes(),
    ultimaSincronizacion(),
    estadoIA(config),
    // Posteos del feed publicados, para promocionar desde acá
    db
      .selectDistinct({ id: publicaciones.id, titulo: publicaciones.titulo, creadoEn: publicaciones.creadoEn })
      .from(publicaciones)
      .innerJoin(publicacionDestinos, and(eq(publicacionDestinos.publicacionId, publicaciones.id), inArray(publicacionDestinos.ubicacion, ['feed', 'reel']), eq(publicacionDestinos.estado, 'ok')))
      .orderBy(desc(publicaciones.creadoEn))
      .limit(6),
  ])
  // Miniatura: la primera imagen de la exportación de cada publicación
  const pubIds = [...new Set(filas.map((f) => f.publicacionId).filter((x): x is number => x != null))]
  const pubs = pubIds.length ? await db.select({ id: publicaciones.id, archivos: exportaciones.archivos }).from(publicaciones).leftJoin(exportaciones, eq(exportaciones.id, publicaciones.exportacionId)).where(inArray(publicaciones.id, pubIds)) : []
  const miniatura = new Map(pubs.map((p) => { const a = p.archivos?.find((x) => !x.endsWith('.mp4')); return [p.id, a ? urlMedia(a) : null] }))
  const cuenta = (estados: readonly EstadoPauta[] | null) => conteos.filter((c) => !estados || estados.includes(c.estado)).reduce((s, c) => s + c.n, 0)

  const lista: FilaPauta[] = filas.map((p) => {
    const obj = p.objetivo as ObjetivoPauta
    return {
      id: p.id,
      titulo: p.titulo,
      objetivo: OBJETIVOS_PAUTA[obj]?.nombre ?? p.objetivo,
      publico: p.publicoNombre,
      fechas: `${corta(p.desde)} → ${corta(p.hasta)}`,
      desde: p.desde,
      hasta: p.hasta,
      porDia: p.porDia,
      gastado: p.gastado,
      total: p.total,
      resultado: resultadoPrincipal(obj, p.gastado, p.resultados),
      alcance: p.resultados?.alcance ?? 0,
      estado: p.estado,
      motivo: p.motivo,
      miniatura: p.publicacionId ? miniatura.get(p.publicacionId) ?? null : null,
    }
  })
  const pct = tope.tope > 0 ? Math.min(100, Math.round((tope.comprometido / tope.tope) * 100)) : 0
  const rechazadas = filas.filter((f) => f.estado === 'rechazada' || f.estado === 'con_problemas')
  const activas = tope.filas.filter((f) => f.estado === 'activa').length
  const enRevision = tope.filas.filter((f) => f.estado === 'en_revision').length

  return (
    <div className="contenido">
      <Cabecera titulo="Pautas" subtitulo="Lo que estás pautando en Meta, lo gastado y los resultados." miga={[{ texto: 'Pautas' }]} />
      {!meta.conectada ? (
        <Aviso tono="ambar" dato="Meta todavía no está conectado:" accion={<Link prefetch={false} className="btn btn-chico" href="/configuracion/meta">Conectar</Link>}>cargá el token en Configuración › Meta.</Aviso>
      ) : !publicidad ? (
        <Aviso tono="ambar" dato="Falta la cuenta publicitaria:" accion={<Link prefetch={false} className="btn btn-chico" href="/configuracion/pautas">Detectar</Link>}>se detecta sola en Configuración › Pautas.</Aviso>
      ) : null}
      <div className="aviso aviso-verde">
        <div>
          <b>Este mes: {pesos(tope.comprometido)} de {pesos(tope.tope)}</b> <span className="aviso-detalle">· {pesos(tope.gastado)} gastados · {activas} {activas === 1 ? 'activa' : 'activas'}{enRevision ? ` · ${enRevision} en revisión` : ''}</span>
          <div className={`medidor medidor-aviso-ancho ${pct >= 100 ? 'medidor-lleno' : pct >= 80 ? 'medidor-aviso' : ''}`}><div style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="aviso-accion"><Link prefetch={false} className="btn btn-chico" href="/configuracion/pautas">Ajustar el tope</Link></div>
      </div>
      {rechazadas.length > 0 && (
        <Aviso tono="ambar" dato={`Meta rechazó o frenó ${rechazadas.length === 1 ? '1 pauta' : `${rechazadas.length} pautas`}:`} accion={<Link prefetch={false} className="btn btn-chico" href="/pautas?ver=rechazadas">Ver</Link>}>
          «{rechazadas[0].titulo}». {rechazadas[0].motivo ?? ''}
        </Aviso>
      )}

      <div className="pautas-arriba">
        <SugerenciaIA ia={disponibilidad(ia, aprox(costoEstimado(config.ia.modelo, 'pauta')))} />
        <section className="tarjeta">
          <h2 className="titulo-seccion">Posteos para promocionar</h2>
          {recientes.length ? (
            <ul className="lista-recientes">
              {recientes.map((r) => <li key={r.id}><span><b>{r.titulo}</b> <span className="texto-chico">{cuando(r.creadoEn)}</span></span><Link prefetch={false} className="btn btn-chico" href={`/pautas/nueva?publicacion=${r.id}`}><Icono nombre="campaign" tamano={16} />Promocionar</Link></li>)}
            </ul>
          ) : <p className="texto-suave">Todavía no hay posteos del feed publicados desde la plataforma.</p>}
        </section>
      </div>

      <nav className="pestanas" aria-label="Filtrar">
        {(Object.keys(PESTANAS) as Pestana[]).map((k) => (
          <Link prefetch={false} key={k} href={k === 'todas' ? '/pautas' : `/pautas?ver=${k}`} className={ver === k ? 'pestana-activa' : ''}>{PESTANAS[k].texto} ({cuenta(PESTANAS[k].estados)})</Link>
        ))}
      </nav>
      <ListaPautas filas={lista} nueva={Number(q.nueva) || null} sincronizado={sinc ? cuando(sinc) : null} hoy={hoyFormosa()} ajustes={{ iva: config.pautas.iva, escribirDesde: config.pautas.escribirDesde, minDiario: publicidad?.minDiario ?? null }} />
    </div>
  )
}
