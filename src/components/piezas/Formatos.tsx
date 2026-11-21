'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icono } from '@/components/Icono'
import type { AnimacionPieza } from '@/lib/db/esquema'
import { DURACIONES, FORMATOS_VIDEO, type FormatoVideo } from '@/lib/video/tipos'
import type { EstadoVideo } from '@/lib/video/exportar'
import { accionArmarVideos, accionEstadoVideos } from '@/app/(panel)/creacion/acciones-video'

export type OpcionFormato = { clave: string; nombre: string; detalle: string }
export type Tema = { id: number; nombre: string; duracion: number; url: string }

/** Casillas de formatos: un contenido, varios formatos. */
export function CasillasFormatos({ opciones, valores, alCambiar }: { opciones: OpcionFormato[]; valores: Record<string, boolean | undefined>; alCambiar: (clave: string, v: boolean) => void }) {
  return (
    <div className="campo">
      <span className="rotulo-columna">Formatos (el mismo contenido)</span>
      {opciones.map((o) => (
        <label key={o.clave} className="opcion-formato">
          <input type="checkbox" checked={!!valores[o.clave]} onChange={(e) => alCambiar(o.clave, e.target.checked)} />
          <span>{o.nombre}</span><small>{o.detalle}</small>
        </label>
      ))}
    </div>
  )
}

/** Ajustes de la animación (duración, ritmo, variante, música y portada) y los videos armados. */
export function PanelVideo({ tipo, id, animacion, alCambiar, musica, formatos, antes, version }: {
  tipo: 'carrusel' | 'promo'
  id: number
  animacion: AnimacionPieza
  alCambiar: (a: AnimacionPieza) => void
  musica: Tema[]
  formatos: FormatoVideo[]
  antes: () => Promise<void>
  version: number
}) {
  const [estados, setEstados] = useState<EstadoVideo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const set = <K extends keyof AnimacionPieza>(k: K, v: AnimacionPieza[K]) => alCambiar({ ...animacion, [k]: v })

  const leer = useCallback(async () => setEstados(await accionEstadoVideos(tipo, id)), [tipo, id])
  // Se vuelve a mirar al guardar cambios (puede quedar desactualizado) y mientras se arma alguno
  useEffect(() => { void leer() }, [leer, version, formatos.join(',')])
  const armando = estados.some((e) => e.exportacion && (e.exportacion.estado === 'en_cola' || e.exportacion.estado === 'corriendo'))
  useEffect(() => {
    if (!armando) return
    const t = setInterval(() => void leer(), 1500)
    return () => clearInterval(t)
  }, [armando, leer])

  if (!formatos.length) return null
  const max = estados.reduce((m, e) => Math.max(m, e.total), 0)
  const omitidas = estados.find((e) => e.omitidas > 0)
  return (
    <div className="panel-video">
      <div className="campo">
        <span className="rotulo-columna">Duración máxima</span>
        <div className="segmentado" role="radiogroup">
          {DURACIONES.map((d) => <button key={d} type="button" role="radio" aria-checked={animacion.duracion === d} className={animacion.duracion === d ? 'segmentado-activo' : ''} onClick={() => set('duracion', d)}>{d} s</button>)}
        </div>
        {omitidas && <span className="texto-chico texto-aviso">No entran todos: quedan afuera {omitidas.omitidas} {omitidas.omitidas === 1 ? 'escena' : 'escenas'}. Subí la duración o sacá productos.</span>}
        {!omitidas && max > 0 && <span className="texto-chico">Dura {max.toLocaleString('es-AR')} s: se ajusta solo al máximo elegido.</span>}
      </div>
      <div className="campo">
        <span className="rotulo-columna">Ritmo</span>
        <div className="segmentado" role="radiogroup">
          {([['suave', 'Suave'], ['dinamico', 'Dinámico']] as const).map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={animacion.ritmo === v} className={animacion.ritmo === v ? 'segmentado-activo' : ''} onClick={() => set('ritmo', v)}>{t}</button>)}
        </div>
      </div>
      <div className="campo">
        <span className="rotulo-columna">Variante</span>
        <div className="segmentado" role="radiogroup">
          {([['auto', 'Automática'], ['1', '1'], ['2', '2'], ['3', '3']] as const).map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={animacion.variante === v} className={animacion.variante === v ? 'segmentado-activo' : ''} onClick={() => set('variante', v)}>{t}</button>)}
        </div>
        <span className="texto-chico">Cambia de qué lado va la foto y cómo entra cada escena.</span>
      </div>
      <label className="campo">
        <span className="rotulo-columna">Música</span>
        <select className="input" value={animacion.musicaId ?? ''} onChange={(e) => set('musicaId', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Sin música</option>
          {musica.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <span className="texto-chico">{musica.length ? 'Temas de tu biblioteca.' : 'Todavía no hay temas.'} <Link href="/configuracion/creacion">Subir música</Link></span>
      </label>
      <label className="campo">
        <span className="rotulo-columna">Portada del reel (segundo)</span>
        <input className="input input-num" inputMode="decimal" value={animacion.portada} onChange={(e) => set('portada', Number(e.target.value.replace(',', '.')) || 0)} />
        <span className="texto-chico">El cuadro de ese segundo es la portada que muestra Instagram.</span>
      </label>

      <span className="rotulo-columna">Videos</span>
      <ul className="lista-videos">
        {formatos.map((f) => {
          const e = estados.find((x) => x.formato === f)
          const x = e?.exportacion
          const corriendo = x && (x.estado === 'en_cola' || x.estado === 'corriendo')
          return (
            <li key={f}>
              <div><b>{FORMATOS_VIDEO[f].nombre}</b> <span className="texto-chico">{FORMATOS_VIDEO[f].ancho}×{FORMATOS_VIDEO[f].alto}{e ? ` · ${e.total.toLocaleString('es-AR')} s` : ''}</span></div>
              <div className="fila-chips">
                {corriendo ? <span className="chip chip-en_cola"><Icono nombre="sync" tamano={14} className="girando" /> Armando… {x!.avance}%</span>
                  : e?.alDia ? <span className="chip chip-ok">LISTO</span>
                    : x?.estado === 'ok' ? <span className="chip chip-en_cola">DESACTUALIZADO</span>
                      : x?.estado === 'error' ? <span className="chip chip-error" title={x.error ?? ''}>FALLÓ</span>
                        : <span className="chip">SIN ARMAR</span>}
                {x?.estado === 'ok' && x.video && <a className="btn btn-chico" href={x.video} download><Icono nombre="download" tamano={16} />MP4</a>}
              </div>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn-pri" disabled={pendiente || armando} onClick={() => empezar(async () => {
        setError(null)
        await antes()
        const r = await accionArmarVideos(tipo, id)
        if ('error' in r) setError(r.error)
        await leer()
      })}><Icono nombre={armando ? 'sync' : 'movie'} className={armando ? 'girando' : ''} />{armando ? 'Armando videos…' : 'Armar videos'}</button>
      <span className="texto-chico">Cada video tarda alrededor de 1 minuto. Si ya está al día, no se arma de nuevo.</span>
      {error && <span className="texto-error" role="alert">{error}</span>}
    </div>
  )
}
