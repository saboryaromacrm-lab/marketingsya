'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { VistaPlaca, MiniPlaca } from '@/components/piezas/Editor'
import { BotonIA, ContextoIA, type DisponibilidadIA } from '@/components/piezas/IA'
import { accionMejorarTexto } from '../../asesor/acciones'
import { aprobarPublicacion, cuotaHoy } from '../acciones'
import {
  aInstante, contarTexto, llevaTexto, MAX_HASHTAGS, MAX_IMAGENES_FEED, MAX_TEXTO, problemasDelTexto, problemasDePlan, textoCuando,
  type DestinosElegidos, type Grupo, type QuePublicar,
} from '@/lib/publicaciones/reglas'

type Placa = { indice: number; ruta: string; grupo: Grupo; formato: 'carrusel' | 'historia' | 'feed' | 'uno'; etiqueta: string; imagen: string | null }
type Props = {
  pieza: { tipo: 'carrusel' | 'promo'; id: number; titulo: string; subtitulo: string; editar: string; productos: number[]; sinFoto: string[]; bajas: string[] }
  placas: Placa[]
  exportacion: { alDia: boolean; cuando: string | null } | null
  textoInicial: string
  altInicial: string | null
  destinosIniciales: DestinosElegidos
  sugerencia: { modo: 'ahora' | 'programar'; fecha: string; hora: string; deLaIdea: boolean }
  horas: { feed: string; historia: string }
  meta: { conectada: boolean; pagina: string | null; instagram: string | null }
  ia: DisponibilidadIA
  // Qué se publica: las imágenes o uno de los videos de la pieza
  que: QuePublicar
  opcionesQue: { que: QuePublicar; nombre: string; href: string }[]
  video: { nombre: string; url: string | null; vista: string; alto: number; total: number } | null
}

type Chequeo = { ok: boolean | null; texto: React.ReactNode }

export function Publicar({ pieza, placas, exportacion, textoInicial, altInicial, destinosIniciales, sugerencia, horas, meta, ia, que, opcionesQue, video }: Props) {
  const router = useRouter()
  const grupos = (['feed', 'historia'] as const).filter((g) => placas.some((p) => p.grupo === g))
  const [elegidas, setElegidas] = useState<number[]>(placas.map((p) => p.indice))
  const sinIg = !meta.instagram
  const [destinos, setDestinos] = useState<DestinosElegidos>(() => ({
    feed: { instagram: destinosIniciales.feed.instagram && !sinIg, facebook: destinosIniciales.feed.facebook },
    historia: { instagram: destinosIniciales.historia.instagram && !sinIg, facebook: destinosIniciales.historia.facebook },
  }))
  const [texto, setTexto] = useState(textoInicial)
  const [alt, setAlt] = useState(altInicial)
  const [modo, setModo] = useState(sugerencia.modo)
  const [fecha, setFecha] = useState(sugerencia.fecha)
  const [hora, setHora] = useState(sugerencia.hora)
  const [vista, setVista] = useState(placas[0]?.indice ?? 0)
  const [cuota, setCuota] = useState<{ usadas: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  // Videos: dónde sale (un solo archivo)
  const grupoVideo = que === 'historiaVideo' ? 'historia' : 'feed'
  const [redesVideo, setRedesVideo] = useState(() => ({ instagram: destinosIniciales[grupoVideo].instagram && !sinIg, facebook: destinosIniciales[grupoVideo].facebook }))
  const [compartirFeed, setCompartirFeed] = useState(true)

  // El cupo del día se pide a Meta sin frenar la pantalla
  useEffect(() => {
    if (meta.conectada) void cuotaHoy().then(setCuota).catch(() => null)
  }, [meta.conectada])

  const conTexto = video ? que !== 'historiaVideo' : llevaTexto(placas, elegidas, destinos)
  const cuenta = contarTexto(texto)
  const problemasTexto = conTexto ? problemasDelTexto(texto) : []
  const problemasPlan = video ? (redesVideo.instagram || redesVideo.facebook ? [] : ['Elegí dónde publicarlo.']) : problemasDePlan(placas, elegidas, destinos)
  const instante = modo === 'programar' ? aInstante(fecha, hora) : null
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const problemaHora = modo === 'programar' && (!instante ? 'Elegí el día y la hora.' : instante.getTime() < ahora + 2 * 60_000 ? 'Esa hora ya pasó (o falta menos de 2 minutos): elegí otra o publicá ahora.' : null)

  const feedElegidas = placas.filter((p) => p.grupo === 'feed' && elegidas.includes(p.indice))
  const historiasElegidas = placas.filter((p) => p.grupo === 'historia' && elegidas.includes(p.indice))

  const chequeos: Chequeo[] = useMemo(() => {
    const c: Chequeo[] = []
    if (feedElegidas.length) c.push({ ok: feedElegidas.length <= MAX_IMAGENES_FEED || !destinos.feed.instagram, texto: `${feedElegidas.length} ${feedElegidas.length === 1 ? 'imagen' : 'imágenes'} para el feed, de 1080×1350 (Instagram acepta hasta ${MAX_IMAGENES_FEED})` })
    if (historiasElegidas.length) c.push({ ok: true, texto: `${historiasElegidas.length} ${historiasElegidas.length === 1 ? 'historia' : 'historias'} de 1080×1920` })
    if (video) c.push({ ok: video.total > 0 && video.total <= 90, texto: `${video.nombre} de ${video.total.toLocaleString('es-AR')} s, 1080×${video.alto}, MP4` })
    c.push(pieza.sinFoto.length ? { ok: false, texto: <>Sin foto: {pieza.sinFoto.join(', ')}. <Link href={pieza.editar}>Abrir la pieza</Link></> } : { ok: true, texto: 'Todos los productos con foto' })
    if (pieza.bajas.length) c.push({ ok: false, texto: `Dados de baja en el ERP: ${pieza.bajas.join(', ')}` })
    if (conTexto) c.push(problemasTexto.length ? { ok: false, texto: problemasTexto[0] } : { ok: true, texto: 'Texto del posteo listo' })
    c.push(meta.conectada ? { ok: true, texto: `Meta conectado${meta.pagina ? ` (${meta.pagina})` : ''}` } : { ok: false, texto: <>Meta no está conectado: <Link href="/configuracion/meta">cargá el token</Link></> })
    if (cuota) c.push({ ok: cuota.usadas < cuota.total, texto: `Hoy: ${cuota.usadas} de ${cuota.total} publicaciones permitidas en Instagram` })
    if (problemaHora) c.push({ ok: false, texto: problemaHora })
    for (const p of problemasPlan) c.push({ ok: false, texto: p })
    return c
  }, [feedElegidas.length, historiasElegidas.length, destinos, pieza, conTexto, problemasTexto, meta, cuota, problemaHora, problemasPlan, video])
  const bloquea = chequeos.some((c) => c.ok === false)

  const alternar = (i: number) => setElegidas((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i].sort((a, b) => a - b)))
  const destino = (g: Grupo, red: 'instagram' | 'facebook', v: boolean) => setDestinos((d) => ({ ...d, [g]: { ...d[g], [red]: v } }))
  const placaVista = placas.find((p) => p.indice === vista) ?? placas[0]

  const textoBoton = modo === 'ahora' ? 'Publicar ahora' : instante ? `Programar para ${textoCuando(instante, new Date(ahora))}` : 'Programar'
  const redes = video
    ? [...(redesVideo.instagram ? ['Instagram'] : []), ...(redesVideo.facebook ? ['Facebook'] : [])]
    : [
        ...(feedElegidas.length && destinos.feed.instagram) || (historiasElegidas.length && destinos.historia.instagram) ? ['Instagram'] : [],
        ...(feedElegidas.length && destinos.feed.facebook) || (historiasElegidas.length && destinos.historia.facebook) ? ['Facebook'] : [],
      ]

  function aprobar() {
    if (modo === 'ahora' && !confirm(`¿Publicar ahora en ${redes.join(' y ')}? Instagram no deja borrar publicaciones desde la plataforma (se borran desde la app).`)) return
    empezar(async () => {
      setError(null)
      const r = await aprobarPublicacion({ tipo: pieza.tipo, id: pieza.id, texto, alt, elegidas, destinos, programar: modo === 'programar' ? { fecha, hora } : null, que, redes: redesVideo, compartirFeed })
      if ('error' in r) setError(r.error)
      else router.push(`/publicaciones?nueva=${r.id}`)
    })
  }

  const notaExportacion = video
    ? video.url ? 'El video ya está armado y al día con la pieza.' : 'El video se arma al confirmar (alrededor de 1 minuto). Lo que ves acá es exactamente lo que sale.'
    : !exportacion
    ? 'Las imágenes se arman al confirmar (tarda unos segundos).'
    : exportacion.alDia
      ? `Exportadas ${exportacion.cuando ?? ''} (están al día con la pieza).`
      : 'La pieza cambió desde la última exportación: al confirmar se arman de nuevo las imágenes. Lo que ves acá es exactamente lo que sale.'

  return (
    <ContextoIA.Provider value={ia}>
      <div className="contenido">
        <Cabecera
          titulo={<>Publicar · {pieza.titulo} <span className="chip chip-titulo">{pieza.tipo === 'carrusel' ? 'CARRUSEL' : 'PROMO'}</span></>}
          subtitulo="Revisá exactamente lo que va a salir. Nada se publica sin tu confirmación."
          miga={[{ texto: 'Publicaciones', href: '/publicaciones' }, { texto: `Publicar · ${pieza.titulo}` }]}
          acciones={<Link className="btn" href={pieza.editar}><Icono nombre="edit" />Volver a la pieza</Link>}
        />
        {opcionesQue.length > 1 && (
          <nav className="pestanas" aria-label="Qué publicás">
            {opcionesQue.map((o) => <Link key={o.que} href={o.href} className={o.que === que ? 'pestana-activa' : ''}>{o.nombre}</Link>)}
          </nav>
        )}

        <div className="publicar">
          {/* ---------- imágenes ---------- */}
          <section className="tarjeta publicar-imagenes" aria-label="Imágenes">
            {video && (
              <div className="publicar-grande">
                {video.url ? <video className="publicar-video" style={{ aspectRatio: `1080 / ${video.alto}` }} src={video.url} controls playsInline loop muted autoPlay /> : <VistaPlaca ruta={video.vista} formato={video.alto === 1920 ? 'historia' : 'feed'} />}
              </div>
            )}
            {!video && placaVista && (
              <div className="publicar-grande">
                {placaVista.imagen ? <img src={placaVista.imagen} alt={`Placa ${placaVista.etiqueta}`} /> : <VistaPlaca ruta={placaVista.ruta} formato={placaVista.formato} />}
              </div>
            )}
            {grupos.map((g) => {
              const delGrupo = placas.filter((p) => p.grupo === g)
              const n = delGrupo.filter((p) => elegidas.includes(p.indice)).length
              return (
                <div key={g} className="campo">
                  <span className="rotulo-columna">{g === 'feed' ? `Feed · ${n} de ${delGrupo.length} en este orden` : `Historias · ${n} de ${delGrupo.length}`}</span>
                  <div className="publicar-tira">
                    {delGrupo.map((p) => {
                      const si = elegidas.includes(p.indice)
                      return (
                        <div key={p.indice} className={`publicar-mini ${vista === p.indice ? 'publicar-mini-activa' : ''} ${si ? '' : 'publicar-mini-fuera'}`}>
                          <button type="button" className="publicar-mini-boton" onClick={() => setVista(p.indice)} aria-label={`Ver ${p.etiqueta}`}>
                            {p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : <MiniPlaca ruta={p.ruta} formato={p.formato} />}
                          </button>
                          <label className="publicar-mini-pie">
                            <input type="checkbox" checked={si} onChange={() => alternar(p.indice)} aria-label={`Incluir ${p.etiqueta}`} />
                            {p.etiqueta}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <p className="texto-chico">{notaExportacion}{video ? '' : ' Destildá las que no quieras publicar.'}</p>
          </section>

          {/* ---------- texto ---------- */}
          <section className="tarjeta" aria-label="Texto">
            <span className="rotulo-columna">Texto del posteo</span>
            {conTexto ? (
              <>
                <textarea className="input area publicar-texto" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto del posteo" />
                <div className={`cuenta-letras ${cuenta.letras > MAX_TEXTO || cuenta.hashtags > MAX_HASHTAGS ? 'texto-error' : ''}`}>
                  {cuenta.letras.toLocaleString('es-AR')} de {MAX_TEXTO.toLocaleString('es-AR')} · {cuenta.hashtags} hashtags de {MAX_HASHTAGS}
                </div>
                <div className="fila-chips">
                  <BotonIA texto="Mejorar con IA" pedir={() => accionMejorarTexto(`${pieza.tipo} «${pieza.titulo}»`, pieza.productos, texto)} alObtener={setTexto} />
                  {texto !== textoInicial && <button type="button" className="enlace texto-chico" onClick={() => setTexto(textoInicial)}>Volver al texto de la pieza</button>}
                </div>
                <p className="texto-chico">Sale igual en Instagram y en Facebook. Si lo cambiás acá, queda guardado también en la pieza.</p>
              </>
            ) : (
              <p className="texto-suave">Las historias no llevan texto: solo {video ? 'el video' : 'la imagen'}.</p>
            )}
            {!video && alt != null && (feedElegidas.length > 0) && (
              <label className="campo">
                <span className="rotulo-columna">Texto alternativo (para lectores de pantalla)</span>
                <textarea className="input area" rows={3} maxLength={1000} value={alt} onChange={(e) => setAlt(e.target.value)} />
                {altInicial && alt !== altInicial && <button type="button" className="enlace texto-chico" onClick={() => setAlt(altInicial)}>Volver al automático</button>}
              </label>
            )}
          </section>

          {/* ---------- dónde, cuándo y revisión ---------- */}
          <section className="tarjeta" aria-label="Dónde y cuándo">
            <span className="rotulo-columna">Dónde</span>
            {video && (
              <>
                <Destino red="instagram" titulo={`Instagram · ${que === 'historiaVideo' ? 'historia' : 'reel'}`} detalle={sinIg ? 'La página no tiene Instagram vinculado' : `@${meta.instagram}`} valor={redesVideo.instagram} deshabilitado={sinIg} alCambiar={(v) => setRedesVideo((r) => ({ ...r, instagram: v }))} />
                {que === 'reel' && redesVideo.instagram && <label className="opcion-formato"><input type="checkbox" checked={compartirFeed} onChange={(e) => setCompartirFeed(e.target.checked)} /><span>También en el feed de Instagram</span></label>}
                <Destino red="facebook" titulo={`Facebook · ${que === 'historiaVideo' ? 'historia' : que === 'reel' ? 'reel' : 'video en la página'}`} detalle={que === 'historiaVideo' ? 'Si Facebook la rechaza, la de Instagram sale igual' : meta.pagina ?? 'Tu página'} valor={redesVideo.facebook} alCambiar={(v) => setRedesVideo((r) => ({ ...r, facebook: v }))} />
              </>
            )}
            {!video && grupos.includes('feed') && (
              <>
                <Destino red="instagram" titulo="Instagram · feed" detalle={sinIg ? 'La página no tiene Instagram vinculado' : `@${meta.instagram} · ${feedElegidas.length > 1 ? 'como carrusel' : 'imagen sola'}`} valor={destinos.feed.instagram} deshabilitado={sinIg} alCambiar={(v) => destino('feed', 'instagram', v)} />
                <Destino red="facebook" titulo="Facebook · página" detalle={`${meta.pagina ?? 'Tu página'} · ${feedElegidas.length > 1 ? 'como álbum' : 'foto sola'}`} valor={destinos.feed.facebook} alCambiar={(v) => destino('feed', 'facebook', v)} />
              </>
            )}
            {!video && grupos.includes('historia') && (
              <>
                <Destino red="instagram" titulo="Instagram · historia" detalle={sinIg ? 'La página no tiene Instagram vinculado' : `@${meta.instagram} · ${historiasElegidas.length} ${historiasElegidas.length === 1 ? 'historia' : 'historias'}`} valor={destinos.historia.instagram} deshabilitado={sinIg} alCambiar={(v) => destino('historia', 'instagram', v)} />
                <Destino red="facebook" titulo="Facebook · historia" detalle="Si Facebook la rechaza, la de Instagram sale igual" valor={destinos.historia.facebook} alCambiar={(v) => destino('historia', 'facebook', v)} />
              </>
            )}

            <span className="rotulo-columna publicar-rotulo">Cuándo</span>
            <label className="opcion-radio"><input type="radio" name="cuando" checked={modo === 'ahora'} onChange={() => setModo('ahora')} /> Ahora</label>
            <label className="opcion-radio"><input type="radio" name="cuando" checked={modo === 'programar'} onChange={() => setModo('programar')} /> Programar</label>
            {modo === 'programar' && (
              <>
                <div className="publicar-fecha">
                  <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Día" />
                  <input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" />
                </div>
                <div className="fila-chips">
                  {(grupos.includes('feed') || (video && que !== 'historiaVideo')) && hora !== horas.feed && <button type="button" className="enlace texto-chico" onClick={() => setHora(horas.feed)}>Hora del feed ({horas.feed})</button>}
                  {(grupos.includes('historia') || que === 'historiaVideo') && hora !== horas.historia && <button type="button" className="enlace texto-chico" onClick={() => setHora(horas.historia)}>Hora de las historias ({horas.historia})</button>}
                </div>
                {sugerencia.deLaIdea && <p className="texto-chico">Es el día que propuso el calendario del asesor.</p>}
              </>
            )}

            <span className="rotulo-columna publicar-rotulo">Revisión</span>
            <ul className="lista-pruebas">
              {chequeos.map((c, i) => <li key={i} className={c.ok === false ? 'prueba-mal' : ''}><Icono nombre={c.ok === false ? 'error' : 'check_circle'} tamano={18} />{c.texto}</li>)}
            </ul>
            <button type="button" className="btn btn-pri publicar-boton" disabled={bloquea || pendiente} onClick={aprobar}>
              <Icono nombre={pendiente ? 'sync' : modo === 'ahora' ? 'send' : 'schedule_send'} className={pendiente ? 'girando' : ''} />
              {pendiente ? 'Guardando…' : textoBoton}
            </button>
            {error && <span className="texto-error" role="alert">{error}</span>}
            <p className="texto-chico">{modo === 'programar' ? 'Programarla ya es tu aprobación: a esa hora se publica sola. Podés cancelarla desde Publicaciones.' : 'Sale en unos segundos. Después la ves en Publicaciones con su enlace.'}</p>
          </section>
        </div>
      </div>
    </ContextoIA.Provider>
  )
}

function Destino({ red, titulo, detalle, valor, alCambiar, deshabilitado = false }: { red: 'instagram' | 'facebook'; titulo: string; detalle: string; valor: boolean; alCambiar: (v: boolean) => void; deshabilitado?: boolean }) {
  return (
    <label className={`destino-meta ${deshabilitado ? 'destino-meta-apagado' : ''}`}>
      <input type="checkbox" checked={valor} disabled={deshabilitado} onChange={(e) => alCambiar(e.target.checked)} />
      <span className={`destino-icono destino-${red}`} aria-hidden="true">{red === 'instagram' ? <Icono nombre="photo_camera" /> : <b>f</b>}</span>
      <span><b>{titulo}</b><small>{detalle}</small></span>
    </label>
  )
}
