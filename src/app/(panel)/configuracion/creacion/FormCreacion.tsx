'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import type { Config } from '@/lib/configuracion-tipos'
import type { TemaMusica } from '@/lib/video/musica'
import { Campo, Segmentado, useGuardar } from '../Formularios'
import { borrarMusica } from '../acciones-creacion'

const FORMATOS: [keyof Config['creacion']['formatos'], string, string][] = [
  ['carrusel', 'Carrusel', 'feed · 1080×1350'],
  ['historia', 'Historia', 'imagen · 1080×1920'],
  ['reel', 'Reel', 'video animado 9:16'],
  ['historiaVideo', 'Historia en video', 'animada · 8 s'],
  ['videoFeed', 'Video de feed', 'animado 4:5'],
]

export function FormCreacion({ inicial, musica, ffmpeg }: { inicial: Config['creacion']; musica: TemaMusica[]; ffmpeg: string | null }) {
  const [v, setV] = useState(inicial)
  const entrada = useGuardar('creacion')
  return (
    <>
      <div className="grilla-config">
        <section className="tarjeta">
          <h2 className="titulo-seccion">Pieza nueva</h2>
          <div className="campo">
            <span className="rotulo-columna">Formatos marcados de entrada</span>
            {FORMATOS.map(([k, t, d]) => (
              <label key={k} className="opcion-formato"><input type="checkbox" checked={v.formatos[k]} onChange={(e) => setV({ ...v, formatos: { ...v.formatos, [k]: e.target.checked } })} /><span>{t}</span><small>{d}</small></label>
            ))}
          </div>
          <div className="campo">
            <span className="rotulo-columna">Duración de los videos</span>
            <Segmentado valor={String(v.animacion.duracion)} opciones={[['8', '8 s'], ['15', '15 s'], ['20', '20 s'], ['30', '30 s']]} alCambiar={(x) => setV({ ...v, animacion: { ...v.animacion, duracion: Number(x) } })} />
          </div>
          <div className="campo">
            <span className="rotulo-columna">Ritmo</span>
            <Segmentado valor={v.animacion.ritmo} opciones={[['suave', 'Suave'], ['dinamico', 'Dinámico']]} alCambiar={(x) => setV({ ...v, animacion: { ...v.animacion, ritmo: x } })} />
          </div>
          {entrada.pie(() => entrada.guardar(v, (c) => setV(c.creacion)))}
        </section>

        <section className="tarjeta">
          <h2 className="titulo-seccion">Motor de video</h2>
          <p className={ffmpeg ? 'texto-ok' : 'texto-error'}>{ffmpeg ? `Listo: ${ffmpeg}.` : 'No se encontró ffmpeg en el servidor: los videos no se van a poder armar.'}</p>
          <p className="texto-chico">Los videos se arman cuadro por cuadro (30 por segundo) con el mismo motor de las placas, de a uno por vez para no cargar el servidor. Un reel de 15 segundos tarda alrededor de 1 minuto.</p>
        </section>
      </div>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Biblioteca de música</h2>
        <SubirTema />
        {musica.length ? (
          <ul className="lista-musica">
            {musica.map((m) => <TemaFila key={m.id} tema={m} />)}
          </ul>
        ) : <p className="texto-suave">Todavía no hay temas. Los videos salen sin música hasta que subas alguno.</p>}
        <details className="ayuda-musica">
          <summary>¿De dónde saco música libre de derechos?</summary>
          <ul>
            <li><b>Biblioteca de audio de YouTube</b> (studio.youtube.com › Biblioteca de audio): filtrá por «No se requiere atribución» y descargá el MP3.</li>
            <li><b>Pixabay Music</b> (pixabay.com/music): su licencia deja usarla gratis, también para publicidad.</li>
            <li>No subas temas de artistas conocidos: Instagram puede silenciar el video o bloquearlo.</li>
          </ul>
        </details>
      </section>
    </>
  )
}

function SubirTema() {
  const router = useRouter()
  const archivo = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  return (
    <div className="fila-campo subir-tema">
      <input className="input" placeholder="Nombre (por ejemplo: Mañana fresca · acústica)" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del tema" />
      <input ref={archivo} type="file" accept=".mp3,.m4a,.aac,.wav,.ogg,audio/*" aria-label="Archivo de música" />
      <button type="button" className="btn btn-pri" disabled={pendiente} onClick={() => empezar(async () => {
        setError(null)
        const f = archivo.current?.files?.[0]
        if (!f) { setError('Elegí un archivo de audio.'); return }
        const datos = new FormData()
        datos.set('archivo', f)
        datos.set('nombre', nombre)
        const r = await fetch('/api/musica', { method: 'POST', body: datos }).then((x) => x.json()).catch(() => ({ error: 'No se pudo subir.' }))
        if (r.error) setError(r.error)
        else { setNombre(''); if (archivo.current) archivo.current.value = ''; router.refresh() }
      })}><Icono nombre={pendiente ? 'sync' : 'upload'} className={pendiente ? 'girando' : ''} />{pendiente ? 'Subiendo…' : 'Subir tema'}</button>
      {error && <span className="texto-error" role="alert">{error}</span>}
    </div>
  )
}

function TemaFila({ tema }: { tema: TemaMusica }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const min = Math.floor(tema.duracion / 60), seg = Math.round(tema.duracion % 60)
  return (
    <li>
      <Icono nombre="music_note" />
      <span><b>{tema.nombre}</b> <span className="texto-chico">{min}:{String(seg).padStart(2, '0')}</span></span>
      <audio controls preload="none" src={tema.url} />
      <button type="button" className="btn btn-chico" aria-label={`Borrar ${tema.nombre}`} disabled={pendiente} onClick={() => { if (confirm(`¿Borrar «${tema.nombre}»? Los videos que lo usaban salen sin música.`)) empezar(async () => { await borrarMusica(tema.id); router.refresh() }) }}><Icono nombre="delete" tamano={16} /></button>
    </li>
  )
}
