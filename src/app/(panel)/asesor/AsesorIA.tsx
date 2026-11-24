'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { TIPOS_IDEA } from '@/lib/configuracion-tipos'
import type { EstadoIA } from '@/lib/ia/claude'
import type { FechaEspecial } from '@/lib/ia/fechas-especiales'
import type { Semana, Sugerencias } from '@/lib/ia/asesor'
import { dolares } from '@/lib/ia/precios'
import { sumarDias } from '@/lib/promos/fechas'
import { marcarProductos } from '@/app/seleccion-acciones'
import { crearPromoDesdeSeleccion } from '../promos/acciones'
import { accionBorrador, accionBorrarChat, accionChat, accionReceta, accionSemana, accionSugerencias } from './acciones'

export type Pestana = 'calendario' | 'sugerencias' | 'recetas' | 'chat'
type Info = Record<number, { nombre: string; foto: string | null }>
type Props = {
  pestana: Pestana
  estadoInicial: EstadoIA
  lunes: string
  hoy: string
  semanaInicial: Semana | null
  sugerenciasIniciales: Sugerencias | null
  chatInicial: { rol: 'user' | 'assistant'; texto: string }[]
  recetas: { id: number; titulo: string }[]
  info: Info
  fechas: FechaEspecial[]
  calendarioVacio: boolean
  costos: { semana: string; sugerencias: string; receta: string; chat: string }
}

const PESTANAS: [Pestana, string, string][] = [['calendario', 'Calendario', 'calendar_month'], ['sugerencias', 'Qué promocionar', 'lightbulb'], ['recetas', 'Recetas', 'restaurant'], ['chat', 'Chat', 'forum']]
const CLASE_TIPO = { nutriofertas: 't-nutri', receta: 't-receta', promo: 't-promo', lanzamiento: 't-lanzamiento', historia: 't-historia' }
const DIA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const ETIQUETA = { nutriofertas: 'NUTRIOFERTAS', receta: 'RECETA', promo: 'PROMO', lanzamiento: 'LANZAMIENTO', historia: 'HISTORIA' }
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`

export function AsesorIA(p: Props) {
  const [estado, setEstado] = useState(p.estadoInicial)
  const bloqueado = !estado.conectada ? 'Cargá la clave de Anthropic en Configuración › Asesor IA para usar el asesor.' : estado.cortada ? 'Llegaste al tope del mes: los botones de IA vuelven el día 1 (o subí el tope en Configuración).' : null
  // Los productos (nombres y fotos) vienen siempre de la página: se actualizan al refrescar tras cada propuesta
  const ctx = { estado, setEstado, bloqueado }
  return (
    <>
      <div className="asesor-barra">
        <nav className="pestanas" aria-label="Secciones del asesor">
          {PESTANAS.map(([k, t, i]) => (
            <Link prefetch={false} key={k} href={`/asesor?pestana=${k}${k === 'calendario' ? `&semana=${p.lunes}` : ''}`} className={p.pestana === k ? 'pestana-activa' : ''} scroll={false}><Icono nombre={i} tamano={16} /> {t}</Link>
          ))}
        </nav>
        <Gasto estado={estado} />
      </div>
      {!estado.conectada && (
        <div className="aviso aviso-ambar"><span><b>Falta conectar la IA:</b> cargá la clave de Anthropic.</span><Link prefetch={false} className="btn btn-chico aviso-accion" href="/configuracion/asesor">Ir a Configuración</Link></div>
      )}
      {estado.conectada && (estado.aviso || estado.cortada) && (
        <div className={`aviso ${estado.cortada ? 'aviso-rojo-tarjeta' : 'aviso-ambar'}`}>
          <span><b>{estado.cortada ? 'Llegaste al tope del mes.' : `Ya usaste el ${Math.round((estado.gasto / estado.tope) * 100)} % del tope del mes.`}</b> {estado.cortada ? 'La IA vuelve el día 1.' : ''}</span>
          <Link prefetch={false} className="btn btn-chico aviso-accion" href="/configuracion/asesor">Cambiar tope</Link>
        </div>
      )}
      {p.pestana === 'calendario' && <Calendario {...p} {...ctx} />}
      {p.pestana === 'sugerencias' && <SugerenciasIA {...p} {...ctx} />}
      {p.pestana === 'recetas' && <Recetas {...p} {...ctx} />}
      {p.pestana === 'chat' && <Chat {...p} {...ctx} />}
    </>
  )
}

export function Gasto({ estado }: { estado: EstadoIA }) {
  const pct = estado.tope > 0 ? Math.min(100, Math.round((estado.gasto / estado.tope) * 100)) : 0
  return (
    <span className={`gasto-ia ${estado.cortada ? 'gasto-lleno' : estado.aviso ? 'gasto-aviso' : ''}`} title="Gasto de IA de este mes">
      <Icono nombre="savings" tamano={16} />{dolares(estado.gasto)} de {dolares(estado.tope)} este mes
      <span className="gasto-barra"><span style={{ width: `${pct}%` }} /></span>
    </span>
  )
}

type Ctx = { estado: EstadoIA; setEstado: (e: EstadoIA) => void; bloqueado: string | null }

function MensajeError({ texto }: { texto: string | null }) {
  return texto ? <p className="texto-error" role="alert">{texto}</p> : null
}

function Minis({ ids, info }: { ids: number[]; info: Info }) {
  return <span className="minis-ia">{ids.slice(0, 6).map((id) => <span key={id} className="miniatura" title={info[id]?.nombre}>{info[id]?.foto ? <img src={info[id].foto!} alt="" /> : <Icono nombre="inventory_2" tamano={14} />}</span>)}</span>
}

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------
function Calendario(p: Props & Ctx) {
  const router = useRouter()
  const [semana, setSemana] = useState(p.semanaInicial)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const [armando, setArmando] = useState<number | null>(null)
  useEffect(() => { setSemana(p.semanaInicial) }, [p.semanaInicial])
  const proponer = () => empezar(async () => {
    setError(null)
    const r = await accionSemana(p.lunes)
    if ('error' in r) return setError(r.error)
    p.setEstado(r.estado)
    setSemana(r.semana)
    router.refresh() // para traer fotos y nombres de los productos nuevos
  })
  const armar = (i: number) => {
    setArmando(i)
    empezar(async () => {
      setError(null)
      const r = await accionBorrador(p.lunes, i)
      setArmando(null)
      if ('error' in r) return setError(r.error)
      p.setEstado(r.estado)
      router.push(r.borrador.tipo === 'promo' ? `/promos/${r.borrador.id}` : `/carruseles/${r.borrador.id}`)
    })
  }
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(p.lunes, i))
  const fechasSemana = p.fechas.filter((f) => f.fecha >= p.lunes)
  return (
    <>
      <div className="fila-acciones">
        <Link prefetch={false} className="btn" href={`/asesor?pestana=calendario&semana=${sumarDias(p.lunes, -7)}`} scroll={false}><Icono nombre="chevron_left" />Semana anterior</Link>
        <b className="semana-titulo">Semana del {fechaCorta(p.lunes)} al {fechaCorta(sumarDias(p.lunes, 6))}</b>
        <Link prefetch={false} className="btn" href={`/asesor?pestana=calendario&semana=${sumarDias(p.lunes, 7)}`} scroll={false}>Semana siguiente<Icono nombre="chevron_right" /></Link>
        <button className="btn btn-pri boton-ia" disabled={!!p.bloqueado || pendiente || p.calendarioVacio} title={p.bloqueado ?? ''} onClick={proponer}>
          <Icono nombre={pendiente && armando == null ? 'sync' : 'auto_awesome'} className={pendiente && armando == null ? 'girando' : ''} />
          {pendiente && armando == null ? 'Pensando la semana…' : `${semana ? 'Volver a proponer' : 'Proponer semana'} (${p.costos.semana})`}
        </button>
      </div>
      {p.calendarioVacio && <p className="texto-suave">No hay días con publicaciones: elegilos en <Link prefetch={false} href="/configuracion/asesor">Configuración › Asesor IA</Link>.</p>}
      {fechasSemana.length > 0 && <div className="fechas-ia"><Icono nombre="event" tamano={16} /><b>Se viene:</b> {fechasSemana.slice(0, 4).map((f) => `${f.nombre} (${fechaCorta(f.fecha)})`).join(' · ')}. La IA ya las tiene en cuenta.</div>}
      <MensajeError texto={error} />
      <div className="semana-ia">
        {dias.map((d, i) => {
          const ideas = semana?.ideas.map((x, k) => ({ ...x, k })).filter((x) => x.dia === d) ?? []
          return (
            <div key={d} className={`dia-ia ${d === p.hoy ? 'dia-hoy' : ''}`}>
              <h4>{DIA_CORTO[i]} {fechaCorta(d)}</h4>
              {ideas.map((x) => (
                <div key={x.k} className="idea-ia">
                  <span className={`chip ${CLASE_TIPO[x.tipo]}`} title={TIPOS_IDEA[x.tipo]}>{ETIQUETA[x.tipo]}</span>
                  <b>{x.titulo}</b>
                  {x.angulo && <span className="texto-chico">{x.angulo}</span>}
                  {x.productos.length > 0 && <Minis ids={x.productos} info={p.info} />}
                  {x.borrador ? (
                    <span className="fila-chips">
                      <Link prefetch={false} className="btn btn-chico" href={x.borrador.tipo === 'promo' ? `/promos/${x.borrador.id}` : `/carruseles/${x.borrador.id}`}><Icono nombre="open_in_new" tamano={16} />Abrir borrador</Link>
                      <Link prefetch={false} className="btn btn-chico" href={`/publicaciones/nueva?${x.borrador.tipo}=${x.borrador.id}&fecha=${x.dia}`}><Icono nombre="send" tamano={16} />Publicar</Link>
                    </span>
                  ) : x.tipo !== 'historia' ? (
                    <button className="btn btn-chico" disabled={pendiente || (x.tipo === 'receta' && !!p.bloqueado)} onClick={() => armar(x.k)}>
                      <Icono nombre={armando === x.k ? 'sync' : 'note_add'} className={armando === x.k ? 'girando' : ''} tamano={16} />
                      {armando === x.k ? 'Armando…' : 'Armar borrador'}
                      {x.tipo === 'receta' && armando !== x.k && <small className="costo-ia">{p.costos.receta}</small>}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <p className="texto-chico">«Armar borrador» crea el carrusel o la promo con los productos cargados (la receta la escribe la IA). Nada se publica sin que lo apruebes: «Publicar» te propone el día de la idea.{semana ? ` Propuesta del ${new Date(semana.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}.` : ''}</p>
    </>
  )
}

// ---------------------------------------------------------------------------
// Qué promocionar
// ---------------------------------------------------------------------------
function SugerenciasIA(p: Props & Ctx) {
  const router = useRouter()
  const [sug, setSug] = useState(p.sugerenciasIniciales)
  const [elegidas, setElegidas] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const pedir = () => empezar(async () => {
    setError(null)
    const r = await accionSugerencias()
    if ('error' in r) return setError(r.error)
    p.setEstado(r.estado)
    setSug(r.sugerencias)
    setElegidas(new Set())
    router.refresh()
  })
  const usar = (destino: 'promo' | 'carrusel') => empezar(async () => {
    await marcarProductos([...elegidas], true)
    if (destino === 'promo') await crearPromoDesdeSeleccion()
    else router.push('/carruseles/nuevo')
  })
  return (
    <>
      <div className="fila-acciones">
        <span className="texto-suave">{sug ? `Ideas del ${new Date(sug.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}. Marcá las que te gusten.` : 'Pedile a la IA qué conviene promocionar ahora.'}</span>
        <span className="fila-acciones-derecha">
          {elegidas.size > 0 && (
            <>
              <button className="btn" disabled={pendiente} onClick={() => usar('promo')}><Icono nombre="sell" />Armar promo ({elegidas.size})</button>
              <button className="btn" disabled={pendiente} onClick={() => usar('carrusel')}><Icono nombre="view_carousel" />Armar carrusel ({elegidas.size})</button>
            </>
          )}
          <button className="btn btn-pri boton-ia" disabled={!!p.bloqueado || pendiente} title={p.bloqueado ?? ''} onClick={pedir}>
            <Icono nombre={pendiente ? 'sync' : 'auto_awesome'} className={pendiente ? 'girando' : ''} />{pendiente ? 'Buscando ideas…' : `${sug ? 'Nuevas ideas' : 'Pedir ideas'} (${p.costos.sugerencias})`}
          </button>
        </span>
      </div>
      <MensajeError texto={error} />
      {sug && (
        <div className="sugerencias-ia">
          {sug.ideas.map((x) => {
            const pr = p.info[x.id]
            const marcada = elegidas.has(x.id)
            return (
              <label key={x.id} className={`tarjeta sugerencia-ia ${marcada ? 'sugerencia-marcada' : ''}`}>
                <input type="checkbox" checked={marcada} onChange={(e) => setElegidas((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n })} />
                <span className="foto-sugerencia">{pr?.foto ? <img src={pr.foto} alt="" /> : <Icono nombre="inventory_2" />}</span>
                <b>{pr?.nombre ?? `Producto ${x.id}`}</b>
                <span className="texto-chico">{x.motivo}</span>
              </label>
            )
          })}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Recetas
// ---------------------------------------------------------------------------
const RESTRICCIONES = ['', 'Sin TACC', 'Vegana', 'Vegetariana', 'Rápida (menos de 15 minutos)', 'Económica', 'Sin azúcar agregada', 'Para chicos', 'Sin cocción']

function Recetas(p: Props & Ctx) {
  const router = useRouter()
  const [restriccion, setRestriccion] = useState('')
  const [idea, setIdea] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const proponer = () => empezar(async () => {
    setError(null)
    const r = await accionReceta(restriccion, idea)
    if ('error' in r) return setError(r.error)
    p.setEstado(r.estado)
    router.push(`/carruseles/${r.id}`)
  })
  return (
    <div className="grilla-config">
      <section className="tarjeta">
        <h2 className="titulo-seccion">Proponer una receta</h2>
        <p className="texto-suave">La IA arma la receta solo con productos del catálogo que tienen foto, y se crea el carrusel Recetas ya lleno para que lo revises.</p>
        <label className="campo"><span className="rotulo-columna">Restricción</span>
          <select className="input" value={restriccion} onChange={(e) => setRestriccion(e.target.value)}>{RESTRICCIONES.map((r) => <option key={r} value={r}>{r || 'Ninguna'}</option>)}</select>
        </label>
        <label className="campo"><span className="rotulo-columna">Idea (opcional)</span>
          <textarea className="input area" rows={2} maxLength={300} placeholder="Ej.: algo fresco para el calor con avena y frutos secos" value={idea} onChange={(e) => setIdea(e.target.value)} />
        </label>
        <div className="form-pie">
          <button className="btn btn-pri boton-ia" disabled={!!p.bloqueado || pendiente} title={p.bloqueado ?? ''} onClick={proponer}>
            <Icono nombre={pendiente ? 'sync' : 'auto_awesome'} className={pendiente ? 'girando' : ''} />{pendiente ? 'Escribiendo la receta…' : `Proponer receta (${p.costos.receta})`}
          </button>
        </div>
        <MensajeError texto={error} />
      </section>
      <section className="tarjeta">
        <h2 className="titulo-seccion">Últimas recetas</h2>
        {p.recetas.length ? (
          <ul className="lista-simple">{p.recetas.map((r) => <li key={r.id}><Link prefetch={false} href={`/carruseles/${r.id}`}>{r.titulo}</Link></li>)}</ul>
        ) : <p className="texto-suave">Todavía no hay recetas.</p>}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
function Chat(p: Props & Ctx) {
  const router = useRouter()
  const [mensajes, setMensajes] = useState(p.chatInicial)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [mensajes, pendiente])
  const enviar = () => {
    const t = texto.trim()
    if (!t) return
    setMensajes((m) => [...m, { rol: 'user', texto: t }])
    setTexto('')
    empezar(async () => {
      setError(null)
      const r = await accionChat(t)
      if ('error' in r) { setError(r.error); setMensajes((m) => m.slice(0, -1)); setTexto(t); return }
      p.setEstado(r.estado)
      setMensajes((m) => [...m, { rol: 'assistant', texto: r.respuesta }])
    })
  }
  return (
    <section className="tarjeta chat-ia">
      <div className="chat-mensajes">
        {!mensajes.length && <p className="texto-suave">Preguntale lo que quieras: «¿qué publico esta semana para el calor?», «dame 3 ideas para el Día de la Madre», «escribime un texto para la yerba con descuento».</p>}
        {mensajes.map((m, i) => <div key={i} className={`burbuja ${m.rol === 'user' ? 'burbuja-yo' : 'burbuja-ia'}`}>{m.texto}</div>)}
        {pendiente && <div className="burbuja burbuja-ia burbuja-pensando"><Icono nombre="sync" className="girando" tamano={16} /> Pensando…</div>}
        <div ref={fin} />
      </div>
      <MensajeError texto={error} />
      <div className="chat-entrada">
        <textarea className="input area" rows={2} maxLength={2000} placeholder="Escribí tu pregunta…" value={texto} disabled={!!p.bloqueado} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
        <button className="btn btn-pri" disabled={!!p.bloqueado || pendiente || !texto.trim()} onClick={enviar}><Icono nombre="send" />Enviar</button>
      </div>
      <div className="fila-separada">
        <span className="texto-chico">Cada mensaje cuesta {p.costos.chat}. Enter envía; Mayúscula + Enter, renglón nuevo.</span>
        {mensajes.length > 0 && <button className="enlace texto-chico" onClick={() => { if (confirm('¿Borrar toda la conversación?')) empezar(async () => { await accionBorrarChat(); setMensajes([]); router.refresh() }) }}>Borrar conversación</button>}
      </div>
    </section>
  )
}
