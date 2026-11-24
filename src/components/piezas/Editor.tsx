'use client'

// Piezas del editor que comparten promos y carruseles: vista previa en vivo, buscador de productos,
// estado del guardado y exportación con el motor.

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { Icono } from '@/components/Icono'
import { imagenMini } from '@/lib/miniaturas'

export type ResultadoBusqueda = { id: number; nombre: string; foto: string; precio: string | null }

export function EstadoGuardado({ estado }: { estado: 'guardado' | 'cambios' | 'guardando' | { error: string } }) {
  if (typeof estado === 'object') return <span className="texto-error estado-guardado" role="alert">{estado.error}</span>
  return (
    <span className="texto-chico estado-guardado" role="status">
      <Icono nombre={estado === 'guardado' ? 'cloud_done' : 'cloud_upload'} tamano={16} />
      {estado === 'guardado' ? 'Guardado' : 'Guardando…'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Buscador: sumar productos sin ir al catálogo
// ---------------------------------------------------------------------------
export function Buscador({ listaId, presentes, alSumar, enfocar = false, buscar, textoBoton = 'Agregar', placeholder = 'Buscar productos para agregar…', cerrarAlSumar = false }: {
  listaId: number; presentes: Set<number>; alSumar: (ids: number[]) => Promise<void>; enfocar?: boolean
  buscar: (q: string, listaId: number) => Promise<{ resultados: ResultadoBusqueda[]; aproximada: boolean }>
  textoBoton?: string; placeholder?: string
  // En un cuadro chico la lista taparía los botones: se cierra y se limpia al sumar
  cerrarAlSumar?: boolean
}) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ q: string; resultados: ResultadoBusqueda[]; aproximada: boolean } | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [sumando, setSumando] = useState<number | null>(null)
  const ultimaQ = useRef('')

  useEffect(() => {
    const texto = q.trim()
    ultimaQ.current = texto
    if (texto.length < 2) { setRes(null); return }
    const t = setTimeout(async () => {
      const r = await buscar(texto, listaId)
      if (ultimaQ.current === texto) setRes({ q: texto, ...r })
    }, 250)
    return () => clearTimeout(t)
  }, [q, listaId, buscar])

  async function sumar(pid: number) {
    setSumando(pid)
    await alSumar([pid])
    setSumando(null)
    if (cerrarAlSumar) { setAbierto(false); setQ('') }
  }
  const buscando = q.trim().length >= 2 && res?.q !== q.trim()

  return (
    <div className="buscador-promo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false) }}>
      <label className="filtro-busqueda">
        <Icono nombre="search" />
        <input
          value={q}
          autoFocus={enfocar}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => { setQ(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAbierto(false)
            if (e.key === 'Enter') {
              e.preventDefault()
              const primero = res?.resultados.find((r) => !presentes.has(r.id))
              if (primero) void sumar(primero.id)
            }
          }}
        />
        {buscando && <Icono nombre="sync" className="girando" tamano={16} />}
      </label>
      {abierto && res && (
        // El foco queda en el buscador al apretar «Agregar», así la lista sigue abierta para sumar varios
        <div className="resultados-promo" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {res.aproximada && res.resultados.length > 0 && <div className="texto-chico resultados-nota">No hay nada escrito así: te mostramos los parecidos.</div>}
          {res.resultados.map((r) => (
            <div key={r.id} className="resultado-promo" role="option" aria-selected={false}>
              <span className="miniatura"><img {...imagenMini(r.foto, 48)} alt="" /></span>
              <span className="resultado-nombre">{r.nombre}<small>{r.precio ?? 'Sin precio en esta lista'}</small></span>
              {presentes.has(r.id) ? (
                <span className="texto-chico">Ya está</span>
              ) : (
                <button className="btn btn-chico" disabled={sumando === r.id} onClick={() => void sumar(r.id)}><Icono nombre="add" tamano={16} />{textoBoton}</button>
              )}
            </div>
          ))}
          {!res.resultados.length && <div className="texto-chico resultados-nota">No encontramos productos con «{res.q}» que tengan foto y vayan en piezas.</div>}
          {res.resultados.length > 0 && <div className="texto-chico resultados-nota">Enter agrega el primero · solo aparecen los que tienen foto</div>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vista previa: la misma página que abre el motor, achicada para que entre.
// ---------------------------------------------------------------------------
export type FormatoVista = 'historia' | 'feed' | 'uno' | 'carrusel'
const ALTO_FORMATO: Record<FormatoVista, number> = { historia: 1920, feed: 1350, uno: 1350, carrusel: 1350 }

export function VistaPlaca({ ruta, formato }: { ruta: string; formato: FormatoVista }) {
  const marco = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.35)
  useLayoutEffect(() => {
    const el = marco.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setEscala(e.contentRect.width / 1080))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  // Se cambia de placa sin parpadeo: la nueva se carga atrás y aparece cuando está lista
  const [visible, setVisible] = useState(ruta)
  const alto = ALTO_FORMATO[formato]
  return (
    <div className={`vista-placa vista-${formato}`} ref={marco} style={{ aspectRatio: `1080 / ${alto}` }}>
      {[...new Set([visible, ruta])].map((r) => (
        <iframe
          key={r}
          src={r}
          title="Vista previa de la placa"
          className={r === ruta ? 'vista-actual' : 'vista-anterior'}
          style={{ width: 1080, height: alto, transform: `scale(${escala})` }}
          onLoad={() => r === ruta && setVisible(r)}
          tabIndex={-1}
        />
      ))}
    </div>
  )
}

export function MiniPlaca({ ruta, formato }: { ruta: string; formato: FormatoVista }) {
  const alto = ALTO_FORMATO[formato]
  const ancho = 72
  return (
    <span className="mini-placa" style={{ width: ancho, height: (ancho * alto) / 1080 }}>
      <iframe src={ruta} title="" loading="lazy" tabIndex={-1} style={{ width: 1080, height: alto, transform: `scale(${ancho / 1080})` }} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Exportar: arma los JPEG con el motor y deja el .zip para descargar
// ---------------------------------------------------------------------------
export type Exportacion = { id: number; estado: string; zip: string | null } | null
export type ResultadoExportar = { ok: true; exportacionId: number } | { error: string }

export function Exportar({ inicial, antes, habilitado, motivo, exportar }: { inicial: Exportacion; antes: () => Promise<void>; habilitado: boolean; motivo: string; exportar: () => Promise<ResultadoExportar> }) {
  const [exp, setExp] = useState<{ id: number; estado: string; avance: number; zip: string | null; error?: string | null } | null>(inicial ? { ...inicial, avance: 100 } : null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const corriendo = pendiente || (exp ? ['en_cola', 'corriendo'].includes(exp.estado) : false)

  useEffect(() => {
    if (!exp || !['en_cola', 'corriendo'].includes(exp.estado)) return
    const t = setTimeout(async () => {
      const r = await fetch(`/api/exportaciones/${exp.id}`, { cache: 'no-store' }).catch(() => null)
      if (r?.ok) setExp(await r.json())
    }, 900)
    return () => clearTimeout(t)
  }, [exp])

  return (
    <>
      {exp?.estado === 'ok' && exp.zip && !corriendo && (
        <a className="btn" href={exp.zip} download><Icono nombre="download" />Descargar .zip</a>
      )}
      <button
        className="btn btn-pri"
        disabled={corriendo || !habilitado}
        title={habilitado ? '' : motivo}
        onClick={() => empezar(async () => {
          setError(null)
          await antes()
          const r = await exportar()
          if ('error' in r) setError(r.error)
          else setExp({ id: r.exportacionId, estado: 'en_cola', avance: 0, zip: null })
        })}
      >
        <Icono nombre={corriendo ? 'sync' : 'image'} className={corriendo ? 'girando' : ''} />
        {corriendo ? `Armando… ${exp?.avance ?? 0}%` : 'Exportar JPEG (.zip)'}
      </button>
      {(error || exp?.estado === 'error') && <span className="texto-error" role="alert">{error ?? `No se pudo exportar: ${exp?.error ?? 'error del motor'}`}</span>}
    </>
  )
}
