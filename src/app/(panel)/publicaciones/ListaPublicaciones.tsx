'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import type { EstadoDestino, EstadoPublicacion, RedSocial, UbicacionDestino } from '@/lib/db/esquema'
import { ETIQUETA_ESTADO } from '@/lib/publicaciones/reglas'
import { cancelar, reintentar } from './acciones'

export type FilaPublicacion = {
  id: number
  titulo: string
  detalle: string
  pieza: string
  miniatura: string | null
  estado: EstadoPublicacion
  cuando: string
  destinos: { red: RedSocial; ubicacion: UbicacionDestino; estado: EstadoDestino; error: string | null; enlace: string | null }[]
}

const ICONO_DESTINO: Record<EstadoDestino, string> = { pendiente: 'schedule', publicando: 'sync', ok: 'check_circle', error: 'error', cancelado: 'block' }
const CORTO = (red: RedSocial, u: UbicacionDestino) => `${red === 'instagram' ? 'IG' : 'FB'} ${u === 'feed' ? (red === 'instagram' ? 'feed' : 'página') : u === 'reel' ? 'reel' : 'historia'}`

/** Agrupa los destinos iguales (cada historia es un destino aparte): «IG historia ×2». */
function agrupar(ds: FilaPublicacion['destinos']) {
  const grupos = new Map<string, FilaPublicacion['destinos']>()
  for (const d of ds) grupos.set(`${d.red}-${d.ubicacion}`, [...(grupos.get(`${d.red}-${d.ubicacion}`) ?? []), d])
  return [...grupos.values()].map((g) => {
    const peor = (['error', 'publicando', 'pendiente', 'cancelado', 'ok'] as EstadoDestino[]).find((e) => g.some((d) => d.estado === e)) ?? 'pendiente'
    return { red: g[0].red, ubicacion: g[0].ubicacion, n: g.length, estado: peor, enlace: g.find((d) => d.enlace)?.enlace ?? null }
  })
}

export function ListaPublicaciones({ filas, nueva }: { filas: FilaPublicacion[]; nueva: number | null }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Mientras algo se está publicando (o está por salir), la lista se actualiza sola
  const enCurso = filas.some((f) => f.estado === 'publicando' || f.estado === 'reintentando' || f.destinos.some((d) => d.estado === 'publicando') || (f.estado === 'programada' && /^hoy/.test(f.cuando)))
  useEffect(() => {
    if (!enCurso) return
    const t = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(t)
  }, [enCurso, router])

  const accion = (fn: () => Promise<{ ok: true } | { error: string }>) =>
    empezar(async () => {
      setError(null)
      const r = await fn()
      if ('error' in r) setError(r.error)
      router.refresh()
    })

  if (!filas.length) {
    return <div className="vacio"><b>Todavía no hay nada acá.</b> Abrí un carrusel o una promo terminada y tocá «Publicar».</div>
  }
  return (
    <>
      {error && <span className="texto-error" role="alert">{error}</span>}
      <div className="tabla-marco">
        <table className="tabla tabla-publicaciones">
          <thead><tr><th aria-label="Imagen" /><th>Pieza</th><th>Dónde</th><th>Cuándo</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
          <tbody>
            {filas.map((f) => {
              const e = ETIQUETA_ESTADO[f.estado]
              const errores = [...new Set(f.destinos.filter((d) => d.estado === 'error' || (d.estado === 'pendiente' && d.error)).map((d) => d.error).filter(Boolean))]
              const enlaces = agrupar(f.destinos).filter((g) => g.enlace && g.estado === 'ok')
              return (
                <tr key={f.id} className={nueva === f.id ? 'fila-nueva' : ''}>
                  <td>{f.miniatura ? <img className="mini-publicacion" src={f.miniatura} alt="" loading="lazy" /> : <span className="mini-publicacion mini-publicacion-vacia"><Icono nombre="image" /></span>}</td>
                  <td><Link href={f.pieza}><b>{f.titulo}</b></Link><div className="texto-chico">{f.detalle}</div></td>
                  <td>
                    <div className="chips">
                      {agrupar(f.destinos).map((g) => (
                        <span key={`${g.red}-${g.ubicacion}`} className={`chip chip-destino chip-destino-${g.estado}`} title={g.estado}>
                          <Icono nombre={ICONO_DESTINO[g.estado]} tamano={14} className={g.estado === 'publicando' ? 'girando' : ''} />
                          {CORTO(g.red, g.ubicacion)}{g.n > 1 ? ` ×${g.n}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="celda-cuando">{f.estado === 'reintentando' ? `Reintenta ${f.cuando}` : f.cuando}</td>
                  <td>
                    <span className={`chip ${e.clase}`}>{e.texto}</span>
                    {errores.map((x) => <div key={x} className="texto-chico texto-error-suave">{x}</div>)}
                  </td>
                  <td>
                    <div className="acciones-publicacion">
                      {(f.estado === 'programada' || f.estado === 'reintentando') && (
                        <button className="btn btn-chico" disabled={pendiente} onClick={() => { if (confirm(`¿Cancelar «${f.titulo}»? No se va a publicar.`)) accion(() => cancelar(f.id)) }}>Cancelar</button>
                      )}
                      {(f.estado === 'error' || f.estado === 'parcial') && (
                        <button className="btn btn-chico" disabled={pendiente} onClick={() => {
                          const dudosa = errores.some((x) => x?.includes('no sabemos si salió'))
                          if (!dudosa || confirm('Alguna no sabemos si salió. Si ya está publicada, reintentar la va a publicar de nuevo. ¿Reintentar igual?')) accion(() => reintentar(f.id))
                        }}><Icono nombre="refresh" tamano={16} />Reintentar</button>
                      )}
                      {f.destinos.some((d) => (d.ubicacion === 'feed' || (d.ubicacion === 'reel' && d.red === 'instagram')) && d.estado === 'ok') && (
                        <Link className="btn btn-chico" href={`/pautas/nueva?publicacion=${f.id}`}><Icono nombre="campaign" tamano={16} />Promocionar</Link>
                      )}
                      {enlaces.map((g) => (
                        <a key={`${g.red}-${g.ubicacion}`} className="btn btn-chico" href={g.enlace!} target="_blank" rel="noreferrer">
                          Ver en {g.red === 'instagram' ? 'Instagram' : 'Facebook'}{g.ubicacion === 'historia' ? ' (historia)' : g.ubicacion === 'reel' ? ' (reel)' : ''}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
