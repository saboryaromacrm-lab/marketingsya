'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { Buscador, EstadoGuardado } from '@/components/piezas/Editor'
import { BotonIA, ContextoIA, type DisponibilidadIA } from '@/components/piezas/IA'
import { ReproductorPropio, type MarcaVista } from '@/components/piezas/ReproductorPropio'
import type { ContenidoVideo, FormatosVideoPropio } from '@/lib/db/esquema'
import type { EstadoVideo } from '@/lib/video/exportar'
import type { VideoDeBiblioteca } from '@/lib/video/propios/datos'
import { FORMATOS_VIDEO, type FormatoVideo } from '@/lib/video/tipos'
import {
  formatosElegidos, MAX_CLIPS, MAX_LETRAS_TEXTO, MAX_PRODUCTOS, MAX_TEXTOS, MAX_TOTAL, MIN_CAPA, MIN_CLIP, mismaForma, mmss, segundos, tiempos as calcularTiempos,
} from '@/lib/video/propios/reglas'
import { accionMejorarTexto, accionSugerirCampo } from '../../../asesor/acciones'
import { buscarParaPromo } from '../../../promos/acciones'
import { accionArmarVideos, accionEstadoVideos } from '../../acciones-video'
import { accionBorrarPiezaVideo, accionDuplicarPiezaVideo, accionGuardarPiezaVideo, type ResumenPieza } from '../acciones'

type Form = { titulo: string; contenido: ContenidoVideo; formatos: FormatosVideoPropio; textoPosteo: string | null }
type Props = {
  id: number
  inicial: Form
  resumenInicial: ResumenPieza
  biblioteca: VideoDeBiblioteca[]
  listas: { id: number; nombre: string }[]
  musica: { id: number; nombre: string; url: string }[]
  ia: DisponibilidadIA
}

const ESTILOS: { clave: ContenidoVideo['estilo']; nombre: string; color: string }[] = [
  { clave: 'nutriofertas', nombre: 'NutriOfertas', color: '#ff8f00' },
  { clave: 'recetas', nombre: 'Recetas', color: '#6E9A35' },
  { clave: 'lanzamiento', nombre: 'Lanzamiento', color: '#e9dcc0' },
  { clave: 'promo', nombre: 'Promo (cinta verde)', color: '#137a52' },
]
const num = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : 0 }

/** Campo de segundos con coma decimal: se puede escribir «3,5». */
function Segundos({ valor, alCambiar, etiqueta }: { valor: number; alCambiar: (n: number) => void; etiqueta: string }) {
  const [texto, setTexto] = useState(segundos(valor))
  const ultimo = useRef(valor)
  useEffect(() => { if (valor !== ultimo.current) { ultimo.current = valor; setTexto(segundos(valor)) } }, [valor])
  return <input className="input input-num" inputMode="decimal" aria-label={etiqueta} value={texto} onChange={(e) => { setTexto(e.target.value); const n = num(e.target.value); ultimo.current = n; alCambiar(n) }} onBlur={() => setTexto(segundos(valor))} />
}

export function EditorVideo({ id, inicial, resumenInicial, biblioteca, listas, musica, ia }: Props) {
  const [form, setForm] = useState(inicial)
  const [resumen, setResumen] = useState(resumenInicial)
  const [version, setVersion] = useState(0)
  const [estado, setEstado] = useState<'guardado' | 'cambios' | 'guardando' | { error: string }>('guardado')
  const [verFormato, setVerFormato] = useState<FormatoVideo>(formatosElegidos(inicial.formatos)[0] ?? 'reel')
  const [ahora, setAhora] = useState(0)
  const [eligiendoClip, setEligiendoClip] = useState(false)
  const [yendo, empezarIr] = useTransition()
  const router = useRouter()
  const c = form.contenido

  // ---------- guardado automático (0,7 s después del último cambio) ----------
  const ultimo = useRef(inicial)
  const guardadoRef = useRef(inicial)
  const enCurso = useRef<Promise<void> | null>(null)
  const guardar = useCallback(async () => {
    const enviar = ultimo.current
    setEstado('guardando')
    const r = await accionGuardarPiezaVideo(id, enviar)
    if ('error' in r && r.error) return setEstado({ error: r.error })
    if ('ok' in r) setResumen(r)
    guardadoRef.current = enviar
    setVersion((v) => v + 1)
    setEstado(ultimo.current === enviar ? 'guardado' : 'cambios')
  }, [id])
  const primera = useRef(true)
  useEffect(() => {
    ultimo.current = form
    if (primera.current) { primera.current = false; return }
    setEstado('cambios')
    const t = setTimeout(() => { enCurso.current = guardar() }, 700)
    return () => clearTimeout(t)
  }, [form, guardar])
  async function guardarYa() {
    await enCurso.current
    if (ultimo.current !== guardadoRef.current) await guardar()
  }

  const setC = (cambio: Partial<ContenidoVideo>) => setForm((f) => ({ ...f, contenido: { ...f.contenido, ...cambio } }))
  const deBiblioteca = (vid: number) => biblioteca.find((v) => v.id === vid)
  const T = calcularTiempos(c)
  const elegidos = formatosElegidos(form.formatos)
  const formato = elegidos.includes(verFormato) ? verFormato : elegidos[0] ?? 'reel'
  const fv = FORMATOS_VIDEO[formato]
  const v = `&v=${version}`
  const rutas = {
    apertura: c.apertura.activa ? `/render/video/propio/${id}?formato=${formato}&parte=apertura${v}` : null,
    cierre: c.cierre.activa ? `/render/video/propio/${id}?formato=${formato}&parte=cierre${v}` : null,
    capas: `/render/video/propio/${id}?formato=${formato}&parte=capas&vista=1${v}`,
  }
  const nombreProducto = (pid: number) => resumen.franjas.find((x) => x.id === pid)?.nombre ?? `Producto ${pid}`
  const marcas: MarcaVista[] = [
    ...c.productos.map((p) => ({ desde: p.desde, hasta: p.hasta, texto: nombreProducto(p.id), tipo: 'producto' as const })),
    ...c.textos.map((x) => ({ desde: x.desde, hasta: x.hasta, texto: x.texto || 'Texto', tipo: 'texto' as const })),
  ]
  const formaDistinta = c.clips.some((x) => { const b = deBiblioteca(x.videoId); return b && !mismaForma(b, fv) })
  const algunoConAudio = c.clips.some((x) => deBiblioteca(x.videoId)?.conAudio)
  const tema = musica.find((m) => m.id === c.sonido.musicaId)
  const contexto = `video propio «${form.titulo}»${resumen.franjas.length ? ` con ${resumen.franjas.map((f) => f.nombre).join(', ')}` : ''}`
  const rev = resumen.revision

  // Arrastrar en el tiempo: un tramo nuevo empieza en el momento que se está viendo
  const tramoDesdeAhora = (dur: number) => {
    const desde = Math.max(0, Math.min(ahora, Math.max(0, T.medio - MIN_CAPA)))
    return { desde: Math.round(desde * 10) / 10, hasta: Math.round(Math.min(T.medio, desde + dur) * 10) / 10 }
  }

  return (
    <ContextoIA.Provider value={ia}>
    <div className="contenido">
      <Cabecera
        titulo={<>{form.titulo || 'Video'} <span className="chip chip-titulo chip-en_cola">VIDEO PROPIO</span></>}
        subtitulo={`${c.clips.length} ${c.clips.length === 1 ? 'clip' : 'clips'} · dura ${segundos(T.total)} s · se guarda solo`}
        miga={[{ texto: 'Creación', href: '/creacion' }, { texto: 'Mis videos', href: '/creacion/videos' }, { texto: form.titulo || `N.º ${id}` }]}
        acciones={
          <>
            <EstadoGuardado estado={estado} />
            <button className="btn" disabled={yendo} onClick={() => empezarIr(async () => { await guardarYa(); const r = await accionDuplicarPiezaVideo(id); if ('id' in r) router.push(`/creacion/videos/${r.id}`) })}><Icono nombre="content_copy" />Duplicar</button>
            <button className="btn" disabled={yendo || rev.bloquean.length > 0} title={rev.bloquean.length ? 'Revisá lo que falta' : 'Publicar en Instagram y Facebook'} onClick={() => empezarIr(async () => { await guardarYa(); router.push(`/publicaciones/nueva?video=${id}${formato !== 'reel' ? `&que=${formato}` : ''}`) })}><Icono nombre="send" />Publicar</button>
          </>
        }
      />
      <div className="editor-video">
        {/* ---------- vista previa ---------- */}
        <section className="tarjeta editor-video-vista" aria-label="Vista previa">
          {elegidos.length > 1 && (
            <div className="segmentado selector-vista" role="radiogroup">
              {elegidos.map((f) => <button key={f} type="button" role="radio" aria-checked={formato === f} className={formato === f ? 'segmentado-activo' : ''} onClick={() => setVerFormato(f)}>{FORMATOS_VIDEO[f].nombre}</button>)}
            </div>
          )}
          <ReproductorPropio
            key={formato}
            ancho={fv.ancho} alto={fv.alto}
            clips={c.clips.map((x) => { const b = deBiblioteca(x.videoId); return { url: b?.archivo ?? null, desde: x.desde, hasta: x.hasta, ancho: b?.ancho ?? 1080, alto: b?.alto ?? 1920, conAudio: !!b?.conAudio } })}
            tiempos={T} encuadre={c.encuadre} rutas={rutas} musica={c.sonido.modo !== 'original' ? tema?.url ?? null : null} sonido={c.sonido.modo}
            marcas={marcas} alMomento={setAhora}
          />
          <span className="texto-chico">Total {segundos(T.total)} s (máximo {elegidos.length ? Math.min(...elegidos.map((f) => MAX_TOTAL[f])) : 90} s). Lo que ves es lo que sale.</span>
          <VideosArmados id={id} formatos={elegidos} version={version} antes={guardarYa} bloqueado={rev.bloquean[0] ?? null} />
        </section>

        <div className="editor-video-panel">
          {(rev.bloquean.length > 0 || rev.avisos.length > 0) && (
            <div className={`revision ${rev.bloquean.length ? 'revision-bloquea' : ''}`} role="status">
              <b><Icono nombre={rev.bloquean.length ? 'block' : 'info'} tamano={18} />{rev.bloquean.length ? 'Para armar el video falta' : 'Para revisar'}</b>
              <ul>{[...rev.bloquean, ...rev.avisos].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}

          <section className="tarjeta seccion-video">
            <label className="campo"><span className="rotulo-columna">Nombre (para encontrarlo)</span><input className="input" value={form.titulo} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} /></label>
          </section>

          {/* ---------- 1. clips ---------- */}
          <section className="tarjeta seccion-video">
            <h2 className="titulo-seccion"><span className="numero-paso">1</span>Clips <small className="texto-suave">hasta {MAX_CLIPS}, se unen con un corte suave</small></h2>
            {c.clips.map((x, i) => {
              const b = deBiblioteca(x.videoId)
              const dur = b?.duracion ?? x.hasta
              const cambiar = (cambio: Partial<typeof x>) => setC({ clips: c.clips.map((y, j) => (j === i ? { ...y, ...cambio } : y)) })
              return (
                <div key={`${x.videoId}-${i}`} className="clip-video">
                  <div className="clip-video-mini">{b?.miniatura ? <img src={b.miniatura} alt="" /> : <Icono nombre="movie" />}</div>
                  <div className="clip-video-cuerpo">
                    <div className="clip-video-fila"><b>{b?.nombre ?? 'Video que ya no está'}</b><span className="texto-chico">usás {mmss(x.desde)} → {mmss(x.hasta)} · {segundos(x.hasta - x.desde)} s de {segundos(dur)} s</span></div>
                    <div className="recorte-doble" style={{ ['--a' as string]: `${(x.desde / dur) * 100}%`, ['--b' as string]: `${(x.hasta / dur) * 100}%` }}>
                      <input type="range" min={0} max={dur} step={0.1} value={x.desde} aria-label="Desde" onChange={(e) => cambiar({ desde: Math.min(Number(e.target.value), x.hasta - MIN_CLIP) })} />
                      <input type="range" min={0} max={dur} step={0.1} value={x.hasta} aria-label="Hasta" onChange={(e) => cambiar({ hasta: Math.max(Number(e.target.value), x.desde + MIN_CLIP) })} />
                    </div>
                    <div className="fila-chips texto-chico">Desde <Segundos etiqueta="Desde el segundo" valor={x.desde} alCambiar={(n) => cambiar({ desde: n })} /> hasta <Segundos etiqueta="Hasta el segundo" valor={x.hasta} alCambiar={(n) => cambiar({ hasta: n })} /> s</div>
                  </div>
                  <div className="clip-video-acciones">
                    <button type="button" className="btn btn-chico" disabled={i === 0} aria-label="Subir" onClick={() => { const cs = [...c.clips]; [cs[i - 1], cs[i]] = [cs[i], cs[i - 1]]; setC({ clips: cs }) }}><Icono nombre="arrow_upward" tamano={16} /></button>
                    <button type="button" className="btn btn-chico" disabled={i === c.clips.length - 1} aria-label="Bajar" onClick={() => { const cs = [...c.clips]; [cs[i + 1], cs[i]] = [cs[i], cs[i + 1]]; setC({ clips: cs }) }}><Icono nombre="arrow_downward" tamano={16} /></button>
                    <button type="button" className="btn btn-chico" aria-label="Sacar el clip" onClick={() => setC({ clips: c.clips.filter((_, j) => j !== i) })}><Icono nombre="delete" tamano={16} /></button>
                  </div>
                </div>
              )
            })}
            {c.clips.length < MAX_CLIPS && (
              <div className="fila-chips">
                <button type="button" className="btn btn-chico" onClick={() => setEligiendoClip((x) => !x)}><Icono nombre="add" tamano={16} />Sumar otro clip</button>
                <Link className="texto-chico" href="/creacion/videos">o subí uno nuevo en «Mis videos»</Link>
              </div>
            )}
            {eligiendoClip && (
              <div className="elegir-clip">
                {biblioteca.length === 0 && <span className="texto-chico">No hay videos listos en «Mis videos».</span>}
                {biblioteca.map((b) => (
                  <button key={b.id} type="button" className="elegir-clip-video" onClick={() => { setC({ clips: [...c.clips, { videoId: b.id, desde: 0, hasta: Math.min(b.duracion, 30) }] }); setEligiendoClip(false) }}>
                    {b.miniatura ? <img src={b.miniatura} alt="" /> : <Icono nombre="movie" />}
                    <span>{b.nombre}</span><small>{mmss(b.duracion)}</small>
                  </button>
                ))}
              </div>
            )}
            {formaDistinta && (
              <div className="campo">
                <span className="rotulo-columna">Video con otra forma ({fv.alto === 1920 ? 'vertical 9:16' : '4:5'})</span>
                <div className="segmentado" role="radiogroup">
                  <button type="button" role="radio" aria-checked={c.encuadre === 'desenfoque'} className={c.encuadre === 'desenfoque' ? 'segmentado-activo' : ''} onClick={() => setC({ encuadre: 'desenfoque' })}><Icono nombre="blur_on" tamano={16} /> Fondo desenfocado</button>
                  <button type="button" role="radio" aria-checked={c.encuadre === 'recorte'} className={c.encuadre === 'recorte' ? 'segmentado-activo' : ''} onClick={() => setC({ encuadre: 'recorte' })}><Icono nombre="crop" tamano={16} /> Recortar al centro</button>
                </div>
                <span className="texto-chico">{c.encuadre === 'desenfoque' ? 'Se ve todo lo que filmaste, con el mismo video desenfocado de fondo.' : 'Ocupa toda la pantalla, pero se pierden los costados.'}</span>
              </div>
            )}
          </section>

          {/* ---------- 2. sonido ---------- */}
          <section className="tarjeta seccion-video">
            <h2 className="titulo-seccion"><span className="numero-paso">2</span>Sonido</h2>
            <div className="segmentado" role="radiogroup">
              {([['original', 'Audio original'], ['musica', 'Música'], ['ambos', 'Los dos']] as const).map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={c.sonido.modo === k} className={c.sonido.modo === k ? 'segmentado-activo' : ''} onClick={() => setC({ sonido: { ...c.sonido, modo: k } })}>{t}</button>)}
            </div>
            {c.sonido.modo !== 'original' && (
              <label className="campo">
                <span className="rotulo-columna">Tema</span>
                <select className="input" value={c.sonido.musicaId ?? ''} onChange={(e) => setC({ sonido: { ...c.sonido, musicaId: e.target.value ? Number(e.target.value) : null } })}>
                  <option value="">Elegí un tema</option>
                  {musica.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <span className="texto-chico">{c.sonido.modo === 'ambos' ? 'La música va bajita debajo de tu voz.' : 'Se escucha solo la música.'} {musica.length ? '' : 'Todavía no hay temas.'} <Link href="/configuracion/creacion">Subir música</Link></span>
              </label>
            )}
            {c.sonido.modo !== 'musica' && c.clips.length > 0 && !algunoConAudio && <span className="texto-chico texto-aviso">Tus clips no tienen sonido: elegí música o va en silencio.</span>}
          </section>

          {/* ---------- 3. marca ---------- */}
          <section className="tarjeta seccion-video">
            <h2 className="titulo-seccion"><span className="numero-paso">3</span>Marca</h2>
            <div className="fila-chips">
              {ESTILOS.map((e) => <button key={e.clave} type="button" className={`estilo-video ${c.estilo === e.clave ? 'estilo-video-activo' : ''}`} aria-pressed={c.estilo === e.clave} onClick={() => setC({ estilo: e.clave })}><i style={{ background: e.color }} />{e.nombre}</button>)}
            </div>
            <span className="texto-chico">Siempre visibles: el logo arriba a la derecha y la tienda arriba a la izquierda.</span>
            <label className="opcion-formato"><input type="checkbox" checked={c.apertura.activa} onChange={(e) => setC({ apertura: { ...c.apertura, activa: e.target.checked } })} /><span><b>Apertura animada</b> (2 s, al principio)</span></label>
            {c.apertura.activa && (
              <div className="dos-campos">
                <label className="campo"><span className="rotulo-columna rotulo-con-ia">Título<BotonIA texto="Sugerir" pedir={() => accionSugerirCampo('titulo', `apertura de un ${contexto}`, c.apertura.titulo)} alObtener={(t) => setC({ apertura: { ...c.apertura, titulo: t.slice(0, 50) } })} /></span><input className="input" value={c.apertura.titulo} maxLength={50} placeholder="¡Llegaron al local!" onChange={(e) => setC({ apertura: { ...c.apertura, titulo: e.target.value } })} /><span className="texto-chico">Con «/» elegís dónde se corta el renglón.</span></label>
                <label className="campo"><span className="rotulo-columna">Arriba del título (opcional)</span><input className="input" value={c.apertura.kicker} maxLength={30} placeholder="Recién llegados" onChange={(e) => setC({ apertura: { ...c.apertura, kicker: e.target.value } })} /></label>
              </div>
            )}
            <label className="opcion-formato"><input type="checkbox" checked={c.cierre.activa} onChange={(e) => setC({ cierre: { ...c.cierre, activa: e.target.checked } })} /><span><b>Cierre con QR</b> (3 s: tienda, WhatsApp e Instagram)</span></label>
            {c.cierre.activa && (
              <div className="dos-campos">
                <label className="campo"><span className="rotulo-columna">Título del cierre</span><input className="input" value={c.cierre.titulo} maxLength={40} onChange={(e) => setC({ cierre: { ...c.cierre, titulo: e.target.value } })} /></label>
                <label className="campo"><span className="rotulo-columna">Bajada</span><input className="input" value={c.cierre.bajada} maxLength={70} onChange={(e) => setC({ cierre: { ...c.cierre, bajada: e.target.value } })} /></label>
              </div>
            )}
          </section>

          {/* ---------- 4. productos ---------- */}
          <section className="tarjeta seccion-video">
            <h2 className="titulo-seccion"><span className="numero-paso">4</span>Productos en el video <small className="texto-suave">hasta {MAX_PRODUCTOS}: aparece una franja con nombre y precio</small></h2>
            <label className="campo campo-corto">
              <span className="rotulo-columna">Lista de precios</span>
              <select className="input" value={c.listaId} onChange={(e) => setC({ listaId: Number(e.target.value) })}>{listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
            </label>
            {c.productos.map((p, i) => {
              const f = resumen.franjas.find((x) => x.id === p.id)
              const cambiar = (cambio: Partial<typeof p>) => setC({ productos: c.productos.map((y, j) => (j === i ? { ...y, ...cambio } : y)) })
              return (
                <div key={p.id} className="franja-editor">
                  <div className="franja-editor-cabeza">
                    {f?.foto ? <img src={f.foto} alt="" /> : <span className="franja-editor-sinfoto"><Icono nombre="inventory_2" /></span>}
                    <div className="franja-editor-nombre"><b>{f?.nombre ?? 'Cargando…'}</b><span className="texto-chico">{f?.precio ? <>{f.precio.antes && <s>{f.precio.antes}</s>} <b className="texto-verde">{f.precio.texto}</b> {f.precio.unidad}</> : 'Sin precio en esta lista'}</span></div>
                    <button type="button" className="btn btn-chico" aria-label={`Sacar ${f?.nombre ?? 'el producto'}`} onClick={() => setC({ productos: c.productos.filter((_, j) => j !== i) })}><Icono nombre="delete" tamano={16} /></button>
                  </div>
                  <div className="fila-chips texto-chico">
                    Aparece del segundo <Segundos etiqueta="Aparece desde" valor={p.desde} alCambiar={(n) => cambiar({ desde: n })} /> al <Segundos etiqueta="Aparece hasta" valor={p.hasta} alCambiar={(n) => cambiar({ hasta: n })} />
                    <button type="button" className="enlace" onClick={() => cambiar({ desde: Math.round(ahora * 10) / 10, hasta: Math.max(Math.round(ahora * 10) / 10 + MIN_CAPA, p.hasta) })}>desde acá ({segundos(ahora)})</button>
                  </div>
                  <div className="fila-chips texto-chico">
                    Descuento <input className="input input-num" inputMode="numeric" aria-label="Descuento" value={p.descuento} onChange={(e) => cambiar({ descuento: Math.max(0, Math.min(90, Math.round(num(e.target.value)))) })} /> %
                    <label className="opcion-formato"><input type="checkbox" checked={p.sello} onChange={(e) => cambiar({ sello: e.target.checked })} /><span>Sello «{p.descuento > 0 ? `-${p.descuento}%` : 'Oferta'}»</span></label>
                    {f?.granel && (
                      <select className="input input-chico" aria-label="Precio de granel" value={p.presentacion ?? ''} onChange={(e) => cambiar({ presentacion: e.target.value || null })}>
                        <option value="">Por kilo</option>
                        {f.presentaciones.map((x) => <option key={x} value={x}>Fraccionado {x}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
            {c.productos.length < MAX_PRODUCTOS && (
              <Buscador listaId={c.listaId} presentes={new Set(c.productos.map((p) => p.id))} buscar={buscarParaPromo} textoBoton="Sumar" placeholder="Buscar un producto para la franja…" alSumar={async (ids) => {
                setC({ productos: [...c.productos, ...ids.filter((x) => !c.productos.some((p) => p.id === x)).slice(0, MAX_PRODUCTOS - c.productos.length).map((x) => ({ id: x, ...tramoDesdeAhora(3), descuento: 0, sello: false, presentacion: null }))] })
              }} />
            )}
            <span className="texto-chico">Tip: pausá la vista previa donde aparece el producto y tocá «desde acá».</span>
          </section>

          {/* ---------- 5. textos ---------- */}
          <section className="tarjeta seccion-video">
            <h2 className="titulo-seccion"><span className="numero-paso">5</span>Textos <small className="texto-suave">hasta {MAX_TEXTOS}, cortitos</small></h2>
            {c.textos.map((x, i) => {
              const cambiar = (cambio: Partial<typeof x>) => setC({ textos: c.textos.map((y, j) => (j === i ? { ...y, ...cambio } : y)) })
              return (
                <div key={i} className="texto-video">
                  <div className="fila-chips">
                    <input className="input texto-video-input" value={x.texto} maxLength={MAX_LETRAS_TEXTO} placeholder="¡Llegó!" aria-label={`Texto ${i + 1}`} onChange={(e) => cambiar({ texto: e.target.value })} />
                    <BotonIA texto="Sugerir" pedir={() => accionSugerirCampo('titulo', `texto corto (máximo 4 palabras) que aparece encima de un ${contexto}`, x.texto)} alObtener={(t) => cambiar({ texto: t.slice(0, MAX_LETRAS_TEXTO) })} />
                    <button type="button" className="btn btn-chico" aria-label={`Sacar el texto ${i + 1}`} onClick={() => setC({ textos: c.textos.filter((_, j) => j !== i) })}><Icono nombre="delete" tamano={16} /></button>
                  </div>
                  <div className="fila-chips texto-chico">
                    Del segundo <Segundos etiqueta="Texto desde" valor={x.desde} alCambiar={(n) => cambiar({ desde: n })} /> al <Segundos etiqueta="Texto hasta" valor={x.hasta} alCambiar={(n) => cambiar({ hasta: n })} />
                    <button type="button" className="enlace" onClick={() => cambiar({ desde: Math.round(ahora * 10) / 10, hasta: Math.max(Math.round(ahora * 10) / 10 + MIN_CAPA, x.hasta) })}>desde acá ({segundos(ahora)})</button>
                  </div>
                </div>
              )
            })}
            {c.textos.length < MAX_TEXTOS && <button type="button" className="btn btn-chico boton-izquierda" onClick={() => setC({ textos: [...c.textos, { texto: '', ...tramoDesdeAhora(2.5) }] })}><Icono nombre="add" tamano={16} />Sumar texto</button>}
          </section>

          {/* ---------- 6. dónde sale ---------- */}
          <section className="tarjeta seccion-video">
            <h2 className="titulo-seccion"><span className="numero-paso">6</span>Dónde sale</h2>
            {(Object.keys(FORMATOS_VIDEO) as FormatoVideo[]).map((f) => (
              <label key={f} className="opcion-formato">
                <input type="checkbox" checked={form.formatos[f]} onChange={(e) => setForm((x) => ({ ...x, formatos: { ...x.formatos, [f]: e.target.checked } }))} />
                <span>{FORMATOS_VIDEO[f].nombre}</span><small>{FORMATOS_VIDEO[f].ancho}×{FORMATOS_VIDEO[f].alto} · hasta {MAX_TOTAL[f]} s</small>
              </label>
            ))}
            <label className="opcion-formato"><span>Portada del reel (segundo)</span><Segundos etiqueta="Segundo de la portada" valor={c.portada} alCambiar={(n) => setC({ portada: Math.max(0, n) })} /><small>el cuadro de ese segundo</small></label>
            <div className="campo">
              <span className="rotulo-columna rotulo-con-ia">Texto del posteo<BotonIA texto="Mejorar con IA" pedir={() => accionMejorarTexto(contexto, resumen.franjas.map((f) => f.id), form.textoPosteo ?? resumen.posteo)} alObtener={(t) => setForm((f) => ({ ...f, textoPosteo: t }))} /></span>
              <textarea className="input area" rows={6} value={form.textoPosteo ?? resumen.posteo} onChange={(e) => setForm((f) => ({ ...f, textoPosteo: e.target.value }))} />
              {form.textoPosteo != null && <button type="button" className="enlace texto-chico boton-izquierda" onClick={() => setForm((f) => ({ ...f, textoPosteo: null }))}>Volver al texto automático</button>}
            </div>
          </section>

          <button type="button" className="btn boton-izquierda" disabled={yendo} onClick={() => empezarIr(async () => {
            if (!confirm(`¿Borrar «${form.titulo}»? Los videos de «Mis videos» no se borran.`)) return
            await accionBorrarPiezaVideo(id)
            router.push('/creacion/piezas')
          })}><Icono nombre="delete" />Borrar esta pieza</button>
        </div>
      </div>
    </div>
    </ContextoIA.Provider>
  )
}

/** Los videos armados de cada formato: listo, desactualizado o armándose, con la descarga del MP4. */
function VideosArmados({ id, formatos, version, antes, bloqueado }: { id: number; formatos: FormatoVideo[]; version: number; antes: () => Promise<void>; bloqueado: string | null }) {
  const [estados, setEstados] = useState<EstadoVideo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const leer = useCallback(async () => setEstados(await accionEstadoVideos('video', id)), [id])
  useEffect(() => { void leer() }, [leer, version, formatos.join(',')])
  const armando = estados.some((e) => e.exportacion && (e.exportacion.estado === 'en_cola' || e.exportacion.estado === 'corriendo'))
  useEffect(() => {
    if (!armando) return
    const t = setInterval(() => void leer(), 1500)
    return () => clearInterval(t)
  }, [armando, leer])
  if (!formatos.length) return null
  return (
    <div className="panel-video">
      <ul className="lista-videos">
        {formatos.map((f) => {
          const e = estados.find((x) => x.formato === f)
          const x = e?.exportacion
          const corriendo = x && (x.estado === 'en_cola' || x.estado === 'corriendo')
          return (
            <li key={f}>
              <b>{FORMATOS_VIDEO[f].nombre}</b>
              <div className="fila-chips">
                {corriendo ? <span className="chip chip-en_cola"><Icono nombre="sync" tamano={14} className="girando" /> Armando… {x!.avance}%</span>
                  : e?.alDia ? <span className="chip chip-ok">LISTO</span>
                    : x?.estado === 'ok' ? <span className="chip chip-en_cola">DESACTUALIZADO</span>
                      : x?.estado === 'error' ? <span className="chip chip-error" title={x.error ?? ''}>FALLÓ</span>
                        : <span className="chip">SIN ARMAR</span>}
                {x?.estado === 'ok' && x.video && <a className="btn btn-chico" href={x.video} download><Icono nombre="download" tamano={16} />MP4</a>}
              </div>
              {x?.estado === 'error' && x.error && <span className="texto-error texto-chico">{x.error}</span>}
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn-pri" disabled={pendiente || armando || !!bloqueado} title={bloqueado ?? undefined} onClick={() => empezar(async () => {
        setError(null)
        await antes()
        const r = await accionArmarVideos('video', id)
        if ('error' in r) setError(r.error)
        await leer()
      })}><Icono nombre={armando ? 'sync' : 'movie'} className={armando ? 'girando' : ''} />{armando ? 'Armando video…' : 'Armar video'}</button>
      <span className="texto-chico">Un video de 30 s tarda 1 o 2 minutos. Si ya está al día, no se arma de nuevo.</span>
      {error && <span className="texto-error" role="alert">{error}</span>}
    </div>
  )
}
