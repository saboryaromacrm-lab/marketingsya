'use client'

// Vista previa en vivo de un video propio: los clips con el fondo desenfocado (o recortados), las capas de la marca
// encima y la apertura y el cierre animados, todo en una sola línea de tiempo. Las capas, la apertura y el cierre
// son las mismas páginas que usa el motor: acá se mueven sus animaciones según el segundo del video.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icono } from '@/components/Icono'
import { mmss, mismaForma, TRANSICION, type Tiempos } from '@/lib/video/propios/reglas'

export type ClipVista = { url: string | null; desde: number; hasta: number; ancho: number; alto: number; conAudio: boolean }
export type MarcaVista = { desde: number; hasta: number; texto: string; tipo: 'producto' | 'texto' }

type Props = {
  ancho: number
  alto: number
  clips: ClipVista[]
  tiempos: Tiempos
  encuadre: 'desenfoque' | 'recorte'
  rutas: { apertura: string | null; cierre: string | null; capas: string }
  musica: string | null
  sonido: 'original' | 'musica' | 'ambos'
  marcas: MarcaVista[]
  // Segundo actual contado desde el comienzo de los clips (para «desde acá» en franjas y textos)
  alMomento?: (medio: number) => void
}

function moverAnimaciones(f: HTMLIFrameElement | null, ms: number) {
  try {
    const doc = f?.contentDocument
    if (!doc) return
    for (const a of doc.getAnimations()) { a.pause(); a.currentTime = Math.max(0, ms) }
  } catch { /* la página todavía carga */ }
}

export function ReproductorPropio({ ancho, alto, clips, tiempos, encuadre, rutas, musica, sonido, marcas, alMomento }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0.3)
  const video = useRef<HTMLVideoElement>(null)
  const fondo = useRef<HTMLCanvasElement>(null)
  const ap = useRef<HTMLIFrameElement>(null)
  const ci = useRef<HTMLIFrameElement>(null)
  const capas = useRef<HTMLIFrameElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const reloj = useRef<HTMLSpanElement>(null)
  const barra = useRef<HTMLInputElement>(null)
  // Quieto, se ve un momento con la apertura ya entera (en el segundo 0 todavía está entrando)
  const t = useRef(tiempos.apertura ? Math.min(1.2, tiempos.total) : 0)
  const jugandoRef = useRef(false)
  const [jugando, setJugando] = useState(false)
  const clipActual = useRef(-1)
  const datos = useRef({ clips, tiempos, encuadre, sonido, musica, alMomento })
  datos.current = { clips, tiempos, encuadre, sonido, musica, alMomento }

  useLayoutEffect(() => {
    const el = caja.current
    if (!el) return
    const medir = () => setK(el.clientWidth / ancho)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ancho])

  const jugar = (si: boolean) => {
    if (si && t.current >= datos.current.tiempos.total - 0.05) t.current = 0
    jugandoRef.current = si
    setJugando(si)
  }

  useEffect(() => {
    let raf = 0
    let antes = performance.now()
    let avisado = 0
    const paso = (ahora: number) => {
      const { clips, tiempos: T, encuadre, sonido, musica, alMomento } = datos.current
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      if (jugandoRef.current) {
        t.current += dt
        if (t.current >= T.total) { t.current = T.total; jugandoRef.current = false; setJugando(false) }
      }
      const s = t.current
      const m = s - T.inicioMedio
      // Apertura y cierre (con su corte suave)
      const inicioCierre = T.total - T.cierre
      if (ap.current) ap.current.style.opacity = String(T.apertura && s < T.apertura ? Math.min(1, (T.apertura - s) / TRANSICION) : 0)
      if (ci.current) ci.current.style.opacity = String(T.cierre && s > inicioCierre ? Math.min(1, (s - inicioCierre) / TRANSICION) : 0)
      moverAnimaciones(ap.current, s * 1000)
      moverAnimaciones(ci.current, (s - inicioCierre) * 1000)
      moverAnimaciones(capas.current, m * 1000)
      if (capas.current) capas.current.style.opacity = m >= 0 && m <= T.medio ? '1' : '0'

      // El clip que corresponde y su segundo
      const v = video.current
      const mm = Math.max(0, Math.min(m, T.medio - 0.01))
      let i = 0
      T.clips.forEach((c, j) => { if (c.inicio <= mm) i = j })
      const clip = clips[i]
      if (v && clip?.url) {
        if (clipActual.current !== i || !v.src.endsWith(clip.url)) {
          clipActual.current = i
          v.src = clip.url
        }
        const deseado = clip.desde + (mm - (T.clips[i]?.inicio ?? 0))
        const enClips = m >= 0 && m < T.medio
        v.muted = sonido === 'musica' || !clip.conAudio
        v.style.objectFit = encuadre === 'recorte' || mismaForma(clip, { ancho, alto }) ? 'cover' : 'contain'
        if (v.readyState >= 1) {
          if (jugandoRef.current && enClips) {
            if (v.paused) void v.play().catch(() => {})
            if (Math.abs(v.currentTime - deseado) > 0.35) v.currentTime = deseado
          } else {
            if (!v.paused) v.pause()
            if (Math.abs(v.currentTime - deseado) > 0.04) v.currentTime = deseado
          }
        }
        // Fondo desenfocado: el mismo video, chico (el desenfoque lo hace el navegador)
        const c = fondo.current
        if (c && v.readyState >= 2 && encuadre === 'desenfoque' && !mismaForma(clip, { ancho, alto })) {
          const ctx = c.getContext('2d')
          if (ctx) {
            const r = Math.max(c.width / (v.videoWidth || 1), c.height / (v.videoHeight || 1))
            const w = (v.videoWidth || 1) * r, h = (v.videoHeight || 1) * r
            ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h)
          }
          c.style.visibility = 'visible'
        } else if (c) c.style.visibility = 'hidden'
      }
      // Música
      const a = audio.current
      if (a && musica && sonido !== 'original') {
        a.volume = sonido === 'ambos' ? 0.25 : 1
        if (jugandoRef.current) {
          if (a.paused) void a.play().catch(() => {})
          const deseado = a.duration ? s % a.duration : s
          if (Math.abs(a.currentTime - deseado) > 0.4) a.currentTime = deseado
        } else if (!a.paused) a.pause()
      } else if (a && !a.paused) a.pause()

      if (reloj.current) reloj.current.textContent = mmss(s)
      if (barra.current && document.activeElement !== barra.current) barra.current.value = String(s)
      if (alMomento && ahora - avisado > 120) { avisado = ahora; alMomento(Math.max(0, Math.round(m * 10) / 10)) }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [ancho, alto])

  const ir = (s: number) => { t.current = Math.max(0, Math.min(tiempos.total, s)) }
  const total = Math.max(0.1, tiempos.total)
  const pos = (s: number) => `${(Math.max(0, Math.min(total, s)) / total) * 100}%`

  return (
    <div className="reproductor-propio">
      <div ref={caja} className="reproductor-caja" style={{ aspectRatio: `${ancho} / ${alto}` }}>
        <div className="reproductor-escenario" style={{ width: ancho, height: alto, transform: `scale(${k})` }}>
          <canvas ref={fondo} className="reproductor-fondo" width={135} height={Math.round((135 * alto) / ancho)} />
          <video ref={video} className="reproductor-video" playsInline preload="auto" />
          <iframe ref={capas} className="reproductor-capa" src={rutas.capas} title="Capas de la marca" tabIndex={-1} />
          {rutas.apertura && <iframe ref={ap} className="reproductor-capa reproductor-opaca" src={rutas.apertura} title="Apertura" tabIndex={-1} />}
          {rutas.cierre && <iframe ref={ci} className="reproductor-capa reproductor-opaca" src={rutas.cierre} title="Cierre" tabIndex={-1} />}
        </div>
        {!clips.some((c) => c.url) && <div className="reproductor-vacio">Sumá un clip para ver la vista previa</div>}
      </div>
      {musica && <audio ref={audio} src={musica} preload="auto" />}
      <div className="reproductor-controles">
        <button type="button" className="btn btn-chico" onClick={() => { ir(0); jugar(true) }} aria-label="Desde el principio"><Icono nombre="replay" /></button>
        <button type="button" className="btn btn-pri btn-chico" onClick={() => jugar(!jugando)} aria-label={jugando ? 'Pausa' : 'Reproducir'}><Icono nombre={jugando ? 'pause' : 'play_arrow'} /></button>
        <span className="reproductor-reloj"><span ref={reloj}>0:00</span> / {mmss(tiempos.total)}</span>
        <input ref={barra} className="reproductor-barra" type="range" min={0} max={total} step={0.05} defaultValue={0} aria-label="Momento del video" onChange={(e) => ir(Number(e.target.value))} />
      </div>
      <div className="linea-tiempo" aria-hidden="true">
        <div className="linea-tiempo-pista">
          {tiempos.apertura > 0 && <span className="lt-apertura" style={{ width: pos(tiempos.apertura) }} onClick={() => ir(0)}>Apertura</span>}
          <span className="lt-clips" style={{ flex: 1 }}>{clips.length} {clips.length === 1 ? 'clip' : 'clips'} · {mmss(tiempos.medio)}</span>
          {tiempos.cierre > 0 && <span className="lt-cierre" style={{ width: pos(tiempos.cierre) }} onClick={() => ir(tiempos.total - tiempos.cierre + 0.4)}>Cierre</span>}
        </div>
        <div className="linea-tiempo-marcas">
          {marcas.map((x, i) => (
            <i key={i} className={x.tipo === 'producto' ? 'lt-producto' : 'lt-texto'} style={{ left: pos(tiempos.inicioMedio + x.desde), width: `calc(${pos(x.hasta - x.desde)} - 2px)` }} onClick={() => ir(tiempos.inicioMedio + x.desde + 0.5)} title={x.texto}>{x.texto}</i>
          ))}
        </div>
      </div>
    </div>
  )
}
