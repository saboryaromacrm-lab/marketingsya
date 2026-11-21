'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { Buscador } from '@/components/piezas/Editor'
import type { VideoListado } from '@/lib/video/propios/biblioteca'
import { mmss } from '@/lib/video/propios/reglas'
import { buscarParaPromo } from '../../promos/acciones'
import { accionBorrarVideo, accionCambiarVideo, accionInfoProductos, accionListarVideos, accionNuevaPiezaVideo } from './acciones'

type Limites = { tamano: number; duracion: number; pedazo: number }
type Subida = { clave: string; nombre: string; tamano: number; enviado: number; id: number | null; estado: 'esperando' | 'subiendo' | 'error' | 'lista'; error: string | null }

const mb = (n: number) => `${Math.max(1, Math.round(n / 1048576)).toLocaleString('es-AR')} MB`
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Cordoba' })
const extensiones = ['mp4', 'mov', 'webm', 'm4v']

/** Sube un archivo en pedazos; si se corta un pedazo, reintenta desde lo que llegó (hasta 4 veces seguidas). */
async function subir(archivo: File, pedazo: number, alAvanzar: (enviado: number) => void, alCrear: (id: number) => void, cancelado: () => boolean): Promise<void> {
  const r = await fetch('/api/videos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre: archivo.name, tamano: archivo.size }) })
  const j = await r.json().catch(() => ({ error: 'No se pudo empezar la subida.' }))
  if (!r.ok || j.error) throw new Error(j.error ?? 'No se pudo empezar la subida.')
  const id: number = j.id
  const tam: number = j.pedazo ?? pedazo
  alCrear(id)
  let desde = 0, fallos = 0
  while (desde < archivo.size) {
    if (cancelado()) throw new Error('Cancelada.')
    try {
      const p = await fetch(`/api/videos/${id}?desde=${desde}`, { method: 'PUT', body: archivo.slice(desde, Math.min(archivo.size, desde + tam)) })
      const x = await p.json().catch(() => ({}))
      if (typeof x.recibido === 'number') desde = x.recibido
      else throw new Error(x.error ?? 'Se cortó la subida.')
      fallos = 0
      alAvanzar(desde)
    } catch (e) {
      if (++fallos > 4) throw e instanceof Error ? e : new Error('Se cortó la subida.')
      await new Promise((r) => setTimeout(r, 1500 * fallos))
    }
  }
  const t = await fetch(`/api/videos/${id}`, { method: 'POST' })
  const tj = await t.json().catch(() => ({}))
  if (!t.ok || tj.error) throw new Error(tj.error ?? 'No se pudo preparar el video.')
}

export function MisVideos({ inicial, limites }: { inicial: VideoListado[]; limites: Limites }) {
  const [lista, setLista] = useState(inicial)
  const [subidas, setSubidas] = useState<Subida[]>([])
  const [ver, setVer] = useState<'todos' | 'sin-usar'>('todos')
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<VideoListado | null>(null)
  const [jugando, setJugando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [yendo, empezarIr] = useTransition()
  const router = useRouter()
  const cancelados = useRef(new Set<string>())
  const input = useRef<HTMLInputElement>(null)

  const leer = useCallback(async () => setLista(await accionListarVideos()), [])
  // Mientras algo se prepara o se sube, la lista se actualiza sola
  const enCurso = lista.some((v) => v.estado === 'procesando' || v.estado === 'subiendo') || subidas.some((s) => s.estado === 'subiendo' || s.estado === 'esperando')
  useEffect(() => {
    if (!enCurso) return
    const t = setInterval(() => void leer(), 2500)
    return () => clearInterval(t)
  }, [enCurso, leer])

  const cambiarSubida = (clave: string, c: Partial<Subida>) => setSubidas((ss) => ss.map((s) => (s.clave === clave ? { ...s, ...c } : s)))

  // Se suben de a uno (así cada uno llega más rápido)
  const cola = useRef<Promise<void>>(Promise.resolve())
  function elegir(archivos: FileList | File[]) {
    setError(null)
    for (const a of Array.from(archivos)) {
      const clave = `${a.name}-${a.size}-${Math.random()}`
      const ext = (a.name.split('.').pop() ?? '').toLowerCase()
      if (!extensiones.includes(ext) && !a.type.startsWith('video/')) { setError(`«${a.name}» no es un video (MP4, MOV o WEBM).`); continue }
      if (a.size > limites.tamano) { setError(`«${a.name}» pesa ${mb(a.size)}: el máximo es ${mb(limites.tamano)}. Recortalo en el celular o mandalo en menor calidad.`); continue }
      setSubidas((ss) => [...ss, { clave, nombre: a.name, tamano: a.size, enviado: 0, id: null, estado: 'esperando', error: null }])
      cola.current = cola.current.then(async () => {
        if (cancelados.current.has(clave)) return
        cambiarSubida(clave, { estado: 'subiendo' })
        try {
          await subir(a, limites.pedazo, (enviado) => cambiarSubida(clave, { enviado }), (id) => { cambiarSubida(clave, { id }); void leer() }, () => cancelados.current.has(clave))
          cambiarSubida(clave, { estado: 'lista' })
          setSubidas((ss) => ss.filter((s) => s.clave !== clave))
        } catch (e) {
          cambiarSubida(clave, { estado: 'error', error: e instanceof Error ? e.message : 'Se cortó la subida.' })
        }
        await leer()
      })
    }
  }

  async function armar(id: number) {
    empezarIr(async () => {
      const r = await accionNuevaPiezaVideo([id])
      if ('error' in r) setError(r.error)
      else router.push(`/creacion/videos/${r.id}`)
    })
  }

  const texto = q.trim().toLowerCase()
  const visibles = lista.filter((v) => v.estado !== 'subiendo' || !subidas.some((s) => s.id === v.id)).filter((v) => (ver === 'todos' || (v.estado === 'listo' && v.piezas === 0)) && (!texto || v.nombre.toLowerCase().includes(texto) || v.productos.some((p) => p.nombre.toLowerCase().includes(texto))))
  const sinUsar = lista.filter((v) => v.estado === 'listo' && v.piezas === 0).length
  const porBorrarse = lista.filter((v) => v.avisar).length

  return (
    <div className="mis-videos">
      <label
        className={`subida-videos ${arrastrando ? 'subida-videos-activa' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files) }}
      >
        <span className="subida-videos-icono"><Icono nombre="cloud_upload" tamano={30} /></span>
        <span className="subida-videos-texto">
          <b>Subí tus videos</b>
          <small>Arrastralos acá o elegilos. En el celular podés elegir de la galería o filmar en el momento. MP4, MOV o WEBM, hasta {mb(limites.tamano)} y {limites.duracion / 60} minutos. Se guarda una copia en 1080p y se borra el original.</small>
        </span>
        <span className="btn btn-pri" role="button" onClick={(e) => { e.preventDefault(); input.current?.click() }}><Icono nombre="video_library" />Elegir videos</span>
        <input ref={input} type="file" accept="video/*,.mov,.mp4,.webm,.m4v" multiple hidden onChange={(e) => { if (e.target.files) elegir(e.target.files); e.target.value = '' }} />
      </label>
      {error && <p className="texto-error" role="alert">{error}</p>}

      {subidas.map((s) => (
        <div key={s.clave} className="carga-video">
          <Icono nombre={s.estado === 'error' ? 'error' : 'movie'} />
          <div className="carga-video-cuerpo">
            <div className="carga-video-fila"><b>{s.nombre}</b><span className="texto-chico">{s.estado === 'error' ? s.error : s.estado === 'esperando' ? `${mb(s.tamano)} · esperando` : `${mb(s.tamano)} · subiendo ${Math.floor((s.enviado / s.tamano) * 100)} %`}</span></div>
            <div className="barra-avance"><i style={{ width: `${(s.enviado / s.tamano) * 100}%` }} /></div>
          </div>
          <button type="button" className="btn btn-chico" onClick={() => { cancelados.current.add(s.clave); setSubidas((ss) => ss.filter((x) => x.clave !== s.clave)) }}>{s.estado === 'error' ? 'Cerrar' : 'Cancelar'}</button>
        </div>
      ))}
      {lista.filter((v) => v.estado === 'procesando').map((v) => (
        <div key={v.id} className="carga-video">
          <Icono nombre="hourglass_top" />
          <div className="carga-video-cuerpo">
            <div className="carga-video-fila"><b>{v.nombre}</b><span className="texto-chico">Preparando la copia en 1080p… {v.avance} %</span></div>
            <div className="barra-avance barra-avance-naranja"><i style={{ width: `${v.avance}%` }} /></div>
          </div>
          <span className="texto-chico">después se borra el original</span>
        </div>
      ))}

      {porBorrarse > 0 && <div className="aviso aviso-ambar"><Icono nombre="schedule" />{porBorrarse === 1 ? 'Un video sin usar se borra' : `${porBorrarse} videos sin usar se borran`} en los próximos días. Tocá «Conservar» si lo querés guardar.</div>}

      <div className="filtros-videos">
        <div className="segmentado" role="radiogroup">
          <button type="button" role="radio" aria-checked={ver === 'todos'} className={ver === 'todos' ? 'segmentado-activo' : ''} onClick={() => setVer('todos')}>Todos ({lista.filter((v) => v.estado !== 'subiendo').length})</button>
          <button type="button" role="radio" aria-checked={ver === 'sin-usar'} className={ver === 'sin-usar' ? 'segmentado-activo' : ''} onClick={() => setVer('sin-usar')}>Sin usar ({sinUsar})</button>
        </div>
        <label className="filtro-busqueda"><Icono nombre="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o producto" aria-label="Buscar videos" /></label>
      </div>

      {!visibles.filter((v) => v.estado !== 'procesando').length && <p className="texto-suave">{lista.length ? 'No hay videos con ese filtro.' : 'Todavía no subiste videos. Filmá un producto en el local y subilo desde el celular.'}</p>}
      <div className="grilla-videos">
        {visibles.filter((v) => v.estado !== 'procesando').map((v) => (
          <article key={v.id} className="tarjeta-video">
            <div className="tarjeta-video-mini">
              {jugando === v.id && v.video ? <video src={v.video} controls autoPlay playsInline /> : v.miniatura ? <img src={v.miniatura} alt="" loading="lazy" /> : <Icono nombre={v.estado === 'error' ? 'error' : 'movie'} tamano={36} />}
              {v.estado === 'listo' && jugando !== v.id && <button type="button" className="tarjeta-video-play" aria-label={`Ver ${v.nombre}`} onClick={() => setJugando(v.id)}><Icono nombre="play_arrow" tamano={28} /></button>}
              {v.ancho && v.alto && jugando !== v.id && <span className="tarjeta-video-forma"><Icono nombre={v.alto > v.ancho ? 'stay_current_portrait' : 'stay_current_landscape'} tamano={13} />{v.alto > v.ancho ? 'Vertical' : v.alto === v.ancho ? 'Cuadrado' : 'Horizontal'}</span>}
              {v.duracion != null && jugando !== v.id && <span className="tarjeta-video-dur">{mmss(v.duracion)}</span>}
            </div>
            <div className="tarjeta-video-cuerpo">
              <b>{v.nombre}</b>
              <span className="texto-chico">Subido el {fecha(v.creadoEn)}</span>
              {v.estado === 'error' && <span className="texto-error texto-chico">{v.error ?? 'No se pudo preparar.'}</span>}
              {v.estado === 'subiendo' && <span className="texto-chico texto-aviso">Subida sin terminar ({mb(v.recibido)} de {mb(v.tamano)}). Se borra sola mañana.</span>}
              {v.productos.length > 0 && <div className="fila-chips">{v.productos.map((p) => <span key={p.id} className="chip-producto-mini">{p.foto && <img src={p.foto} alt="" />}{p.nombre}</span>)}</div>}
              {v.estado === 'listo' && (v.piezas > 0
                ? <span className="chip chip-ok">Usado en {v.piezas} {v.piezas === 1 ? 'pieza' : 'piezas'}</span>
                : v.conservar ? <span className="chip">Sin usar · se conserva</span>
                  : v.avisar && v.borrado ? <span className="aviso-chico"><Icono nombre="schedule" tamano={14} />Sin usar: se borra el {fecha(v.borrado)}<button type="button" className="enlace" onClick={async () => { await accionCambiarVideo(v.id, { conservar: true }); await leer() }}>Conservar</button></span>
                    : <span className="chip">Sin usar</span>)}
            </div>
            <div className="tarjeta-video-pie">
              <button type="button" className="btn btn-pri btn-chico" disabled={v.estado !== 'listo' || yendo} onClick={() => void armar(v.id)}><Icono nombre="movie_edit" tamano={16} />Armar video</button>
              <button type="button" className="btn btn-chico" aria-label={`Opciones de ${v.nombre}`} onClick={() => setEditando(v)}><Icono nombre="more_horiz" tamano={16} /></button>
            </div>
          </article>
        ))}
      </div>

      {editando && <EditarVideo video={editando} cerrar={() => setEditando(null)} alGuardar={leer} />}
    </div>
  )
}

/** Cuadro para renombrar, marcar los productos que aparecen, conservar o borrar un video. */
function EditarVideo({ video, cerrar, alGuardar }: { video: VideoListado; cerrar: () => void; alGuardar: () => Promise<void> }) {
  const [nombre, setNombre] = useState(video.nombre)
  const [productos, setProductos] = useState(video.productos)
  const [conservar, setConservar] = useState(video.conservar)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  return (
    <div className="dialogo-fondo" role="dialog" aria-modal="true" aria-label={`Editar ${video.nombre}`} onClick={(e) => { if (e.target === e.currentTarget) cerrar() }}>
      <div className="dialogo">
        <h2 className="titulo-seccion">Editar video</h2>
        <label className="campo"><span className="rotulo-columna">Nombre</span><input className="input" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} /></label>
        <div className="campo">
          <span className="rotulo-columna">Productos que aparecen</span>
          <span className="texto-chico">Sirven para buscar el video y salen solos como franjas al armarlo.</span>
          <div className="fila-chips">{productos.map((p) => <span key={p.id} className="chip chip-editable">{p.nombre}<button type="button" aria-label={`Sacar ${p.nombre}`} onClick={() => setProductos((ps) => ps.filter((x) => x.id !== p.id))}><Icono nombre="close" tamano={14} /></button></span>)}</div>
          <Buscador listaId={3} presentes={new Set(productos.map((p) => p.id))} buscar={buscarParaPromo} textoBoton="Sumar" placeholder="Buscar productos del video…" cerrarAlSumar alSumar={async (ids) => {
            const info = await accionInfoProductos(ids)
            setProductos((ps) => [...ps, ...info.filter((x) => !ps.some((p) => p.id === x.id))])
          }} />
        </div>
        <label className="opcion-formato"><input type="checkbox" checked={conservar} onChange={(e) => setConservar(e.target.checked)} /><span>Conservar aunque no lo use (no se borra a los 90 días)</span></label>
        {error && <p className="texto-error" role="alert">{error}</p>}
        <div className="fila-chips dialogo-botones">
          <button type="button" className="btn boton-izquierda" disabled={pendiente} onClick={() => empezar(async () => {
            if (!confirm(`¿Borrar «${video.nombre}»? No se puede deshacer.`)) return
            const r = await accionBorrarVideo(video.id)
            if ('error' in r) return setError(r.error)
            await alGuardar()
            cerrar()
          })}><Icono nombre="delete" />Borrar</button>
          <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
          <button type="button" className="btn btn-pri" disabled={pendiente} onClick={() => empezar(async () => {
            await accionCambiarVideo(video.id, { nombre, productos: productos.map((p) => p.id), conservar })
            await alGuardar()
            cerrar()
          })}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
