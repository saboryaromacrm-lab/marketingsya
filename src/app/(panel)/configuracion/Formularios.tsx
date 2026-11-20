'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { DIAS, MODELOS_IA, NOMBRE_DIA, TIPOS_IDEA, partirWeb, type Config, type ModeloIA } from '@/lib/configuracion-tipos'
import type { EstadoIA } from '@/lib/ia/claude'
import { dolares } from '@/lib/ia/precios'
import { borrarClaveIA, guardarClaveIA, guardarConfig } from './acciones-config'

type Seccion = 'contacto' | 'piezas' | 'ia' | 'meta' | 'pautas'

/** Botón «Guardar cambios» con su estado. */
export function useGuardar<K extends Seccion>(seccion: K) {
  const [pendiente, empezar] = useTransition()
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const guardar = (valores: Partial<Config[K]>, alGuardar?: (c: Config) => void) =>
    empezar(async () => {
      setMensaje(null)
      const r = await guardarConfig(seccion, valores)
      if ('error' in r) setMensaje({ ok: false, texto: r.error })
      else { setMensaje({ ok: true, texto: 'Guardado' }); alGuardar?.(r.config) }
    })
  const pie = (alGuardar: () => void, texto = 'Guardar cambios') => (
    <div className="form-pie">
      <button className="btn btn-pri" disabled={pendiente} onClick={alGuardar}><Icono nombre="save" />{pendiente ? 'Guardando…' : texto}</button>
      {mensaje && <span className={mensaje.ok ? 'texto-ok' : 'texto-error'} role="status">{mensaje.texto}</span>}
    </div>
  )
  return { guardar, pie }
}

export function Campo({ rotulo, children, ayuda }: { rotulo: string; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <label className="campo">
      <span className="rotulo-columna">{rotulo}</span>
      {children}
      {ayuda && <span className="texto-chico">{ayuda}</span>}
    </label>
  )
}

export function Interruptor({ valor, alCambiar, texto }: { valor: boolean; alCambiar: (v: boolean) => void; texto: ReactNode }) {
  return (
    <label className="interruptor">
      <input type="checkbox" role="switch" checked={valor} onChange={(e) => alCambiar(e.target.checked)} />
      <span className="interruptor-pista" aria-hidden="true" />
      <span>{texto}</span>
    </label>
  )
}

export function Segmentado<T extends string>({ valor, opciones, alCambiar }: { valor: T; opciones: [T, string][]; alCambiar: (v: T) => void }) {
  return (
    <div className="segmentado" role="radiogroup">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} className={valor === v ? 'segmentado-activo' : ''} onClick={() => alCambiar(v)}>{t}</button>
      ))}
    </div>
  )
}

/** Lista de textos editable como chips (hashtags, slogans, palabras prohibidas). */
export function ListaEditable({ valores, alCambiar, placeholder, peligro = false }: { valores: string[]; alCambiar: (v: string[]) => void; placeholder: string; peligro?: boolean }) {
  const [nuevo, setNuevo] = useState('')
  const sumar = () => {
    const t = nuevo.trim()
    if (t && !valores.includes(t)) alCambiar([...valores, t])
    setNuevo('')
  }
  return (
    <div className="lista-chips">
      {valores.map((v) => (
        <span key={v} className={`chip chip-editable ${peligro ? 'chip-peligro' : ''}`}>
          {v}
          <button type="button" aria-label={`Sacar ${v}`} onClick={() => alCambiar(valores.filter((x) => x !== v))}><Icono nombre="close" tamano={14} /></button>
        </span>
      ))}
      <input className="input input-chip" value={nuevo} placeholder={placeholder} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sumar() } }} onBlur={sumar} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// General: datos de contacto
// ---------------------------------------------------------------------------
export function FormContacto({ inicial }: { inicial: Config['contacto'] }) {
  const [v, setV] = useState(inicial)
  const { guardar, pie } = useGuardar('contacto')
  const [a, b, c] = partirWeb(v.web || 'tienda.com')
  return (
    <div className="form-columnas">
      <Campo rotulo="Tienda online" ayuda={<>Así sale en las placas: {a}<b className="texto-verde">{b}</b>{c}</>}><input className="input" value={v.web} onChange={(e) => setV({ ...v, web: e.target.value })} /></Campo>
      <Campo rotulo="WhatsApp" ayuda="Sale como «WhatsApp 370 462-1563»."><input className="input" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} /></Campo>
      <Campo rotulo="Instagram"><input className="input" value={v.instagram} onChange={(e) => setV({ ...v, instagram: e.target.value })} /></Campo>
      {pie(() => guardar(v, (cfg) => setV(cfg.contacto)))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Piezas: valores de entrada
// ---------------------------------------------------------------------------
export function FormPiezas({ inicial, listas }: { inicial: Config['piezas']; listas: { id: number; nombre: string }[] }) {
  const [v, setV] = useState(inicial)
  const { guardar, pie } = useGuardar('piezas')
  return (
    <div className="form-columnas">
      <Campo rotulo="Lista de precios"><select className="input" value={v.listaId} onChange={(e) => setV({ ...v, listaId: Number(e.target.value) })}>{listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></Campo>
      <Campo rotulo="Descuento de entrada en promos (%)"><input className="input" inputMode="decimal" value={v.descuento} onChange={(e) => setV({ ...v, descuento: Number(e.target.value.replace(',', '.')) || 0 })} /></Campo>
      <Campo rotulo="Días de vigencia de una promo nueva"><input className="input" inputMode="numeric" value={v.vigenciaDias} onChange={(e) => setV({ ...v, vigenciaDias: Number(e.target.value) || 0 })} /></Campo>
      <div className="campo">
        <span className="rotulo-columna">Formatos marcados en una promo nueva</span>
        {([['historia', 'Historias y WhatsApp'], ['feed', 'Feed de Instagram'], ['uno', 'Uno por producto']] as const).map(([k, t]) => (
          <label key={k} className="opcion-formato"><input type="checkbox" checked={v.formatos[k]} onChange={(e) => setV({ ...v, formatos: { ...v.formatos, [k]: e.target.checked } })} /><span>{t}</span></label>
        ))}
      </div>
      {pie(() => guardar(v, (cfg) => setV(cfg.piezas)))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Asesor IA
// ---------------------------------------------------------------------------
export function FormAsesor({ inicial, estado }: { inicial: Config['ia']; estado: EstadoIA }) {
  const [v, setV] = useState(inicial)
  const set = <K extends keyof Config['ia']>(k: K, x: Config['ia'][K]) => setV((p) => ({ ...p, [k]: x }))
  const conexion = useGuardar('ia'), presupuesto = useGuardar('ia'), voz = useGuardar('ia'), calendario = useGuardar('ia'), criterios = useGuardar('ia')
  const pct = estado.tope > 0 ? Math.min(100, Math.round((estado.gasto / estado.tope) * 100)) : 0
  return (
    <>
      <div className="grilla-config">
        <section className="tarjeta">
          <h2 className="titulo-seccion">Conexión con Claude</h2>
          <ClaveIA estado={estado} modelo={v.modelo} />
          <Campo rotulo="Modelo">
            <select className="input" value={v.modelo} onChange={(e) => set('modelo', e.target.value as ModeloIA)}>
              {(Object.keys(MODELOS_IA) as ModeloIA[]).map((m) => <option key={m} value={m}>{MODELOS_IA[m].nombre} · {MODELOS_IA[m].detalle}</option>)}
            </select>
          </Campo>
          <div className="campo">
            <span className="rotulo-columna">Profundidad</span>
            <Segmentado valor={v.profundidad} opciones={[['rapida', 'Rápida'], ['normal', 'Normal'], ['fondo', 'A fondo']]} alCambiar={(x) => set('profundidad', x)} />
            <span className="texto-chico">Más profundidad, mejores ideas y un poco más de costo.</span>
          </div>
          {conexion.pie(() => conexion.guardar({ modelo: v.modelo, profundidad: v.profundidad }))}
        </section>

        <section className="tarjeta">
          <h2 className="titulo-seccion">Presupuesto del mes</h2>
          <div>
            <div className="fila-separada"><b>{dolares(estado.gasto)} de {dolares(estado.tope)}</b><span className="texto-suave">{pct} %</span></div>
            <div className={`medidor ${estado.cortada ? 'medidor-lleno' : estado.aviso ? 'medidor-aviso' : ''}`}><div style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="form-columnas">
            <Campo rotulo="Tope total (US$)" ayuda="Entre la IA de texto y la de imágenes."><input className="input" inputMode="decimal" value={v.topeTotal} onChange={(e) => set('topeTotal', Number(e.target.value.replace(',', '.')) || 0)} /></Campo>
            <Campo rotulo="Para texto (US$)" ayuda={`Quedan ${dolares(Math.max(0, v.topeTotal - v.topeTexto))} para imágenes.`}><input className="input" inputMode="decimal" value={v.topeTexto} onChange={(e) => set('topeTexto', Number(e.target.value.replace(',', '.')) || 0)} /></Campo>
            <Campo rotulo="Avisar al (%)"><input className="input" inputMode="numeric" value={v.avisoPct} onChange={(e) => set('avisoPct', Number(e.target.value) || 0)} /></Campo>
          </div>
          <Interruptor valor={v.cortar} alCambiar={(x) => set('cortar', x)} texto={<><b>Cortar al llegar al tope</b><span className="texto-chico"> Los botones de IA se apagan hasta el día 1.</span></>} />
          <p className="texto-chico">Te recomendamos poner el mismo tope en console.anthropic.com (Settings › Limits), como doble seguro.</p>
          {presupuesto.pie(() => presupuesto.guardar({ topeTotal: v.topeTotal, topeTexto: v.topeTexto, avisoPct: v.avisoPct, cortar: v.cortar }))}
        </section>
      </div>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Voz de la marca</h2>
        <Campo rotulo="Tono"><textarea className="input area" rows={3} value={v.tono} onChange={(e) => set('tono', e.target.value)} /></Campo>
        <div className="grilla-config">
          <div className="campo"><span className="rotulo-columna">Emojis</span><Segmentado valor={v.emojis} opciones={[['ninguno', 'Ninguno'], ['pocos', 'Pocos'], ['mas', 'Más']]} alCambiar={(x) => set('emojis', x)} /></div>
          <div className="campo"><span className="rotulo-columna">Hashtags fijos</span><ListaEditable valores={v.hashtags} alCambiar={(x) => set('hashtags', x)} placeholder="Sumar hashtag…" /></div>
          <div className="campo"><span className="rotulo-columna">Slogans aprobados</span><ListaEditable valores={v.slogans} alCambiar={(x) => set('slogans', x)} placeholder="Sumar slogan…" /></div>
          <div className="campo"><span className="rotulo-columna">Nunca decir</span><ListaEditable valores={v.prohibidas} alCambiar={(x) => set('prohibidas', x)} placeholder="Sumar palabra…" peligro /></div>
        </div>
        {voz.pie(() => voz.guardar({ tono: v.tono, emojis: v.emojis, hashtags: v.hashtags, slogans: v.slogans, prohibidas: v.prohibidas }))}
      </section>

      <div className="grilla-config">
        <section className="tarjeta">
          <h2 className="titulo-seccion">Calendario</h2>
          <div className="dias-config">
            {DIAS.map((d) => (
              <label key={d} className="dia-config">
                <span className="rotulo-columna">{NOMBRE_DIA[d]}</span>
                <select className="input" value={v.calendario[d]} onChange={(e) => set('calendario', { ...v.calendario, [d]: e.target.value as Config['ia']['calendario'][typeof d] })}>
                  <option value="nada">Nada</option>
                  {Object.entries(TIPOS_IDEA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </label>
            ))}
          </div>
          <Interruptor valor={v.fechasEspeciales} alCambiar={(x) => set('fechasEspeciales', x)} texto={<><b>Fechas especiales de Argentina</b><span className="texto-chico"> Día de la Madre, Navidad, vuelta a clases, Día del Celíaco…</span></>} />
          {calendario.pie(() => calendario.guardar({ calendario: v.calendario, fechasEspeciales: v.fechasEspeciales }))}
        </section>

        <section className="tarjeta">
          <h2 className="titulo-seccion">Qué promocionar</h2>
          <p className="texto-suave">La IA tiene en cuenta:</p>
          <label className="opcion-formato"><input type="checkbox" checked={v.criterios.nuevos} onChange={(e) => set('criterios', { ...v.criterios, nuevos: e.target.checked })} /><span>Productos nuevos (últimos 30 días)</span></label>
          <label className="opcion-formato"><input type="checkbox" checked={v.criterios.bajaron} onChange={(e) => set('criterios', { ...v.criterios, bajaron: e.target.checked })} /><span>Bajaron de precio</span></label>
          <label className="opcion-formato"><input type="checkbox" checked={v.criterios.epoca} onChange={(e) => set('criterios', { ...v.criterios, epoca: e.target.checked })} /><span>La época del año</span></label>
          <label className="opcion-formato"><input type="checkbox" checked={v.criterios.sinUsar} onChange={(e) => set('criterios', { ...v.criterios, sinUsar: e.target.checked })} /><span>Sin usar en piezas hace más de</span><input className="input input-num" inputMode="numeric" value={v.criterios.diasSinUsar} onChange={(e) => set('criterios', { ...v.criterios, diasSinUsar: Number(e.target.value) || 1 })} aria-label="Días sin usar" /><span>días</span></label>
          <Campo rotulo="Ideas por vez"><input className="input input-num" inputMode="numeric" value={v.ideasPorVez} onChange={(e) => set('ideasPorVez', Number(e.target.value) || 8)} /></Campo>
          {criterios.pie(() => criterios.guardar({ criterios: v.criterios, ideasPorVez: v.ideasPorVez }))}
        </section>
      </div>
    </>
  )
}

/** Cargar, cambiar o sacar la clave de Anthropic (se prueba antes de guardar; nunca se muestra entera). */
function ClaveIA({ estado, modelo }: { estado: EstadoIA; modelo: ModeloIA }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(!estado.conectada)
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  return (
    <div className="campo">
      {estado.conectada ? (
        <div className="fila-chips">
          <span className="chip chip-ok"><Icono nombre="check_circle" tamano={14} /> Conectada</span>
          <span className="texto-suave">Clave terminada en ···{estado.finClave}{estado.origen === 'entorno' ? ' (de Dokploy)' : ''}</span>
          <button type="button" className="btn btn-chico" onClick={() => setAbierto(!abierto)}>{abierto ? 'Cancelar' : 'Cambiar clave'}</button>
          {estado.origen === 'configuracion' && <button type="button" className="enlace texto-chico" onClick={() => { if (confirm('¿Sacar la clave? El asesor deja de funcionar hasta que cargues otra.')) empezar(async () => { await borrarClaveIA(); router.refresh() }) }}>Sacar</button>}
        </div>
      ) : (
        <p className="texto-suave">Para usar el asesor, creá una clave en <b>console.anthropic.com</b> (Settings › API Keys), cargá saldo y pegala acá. Se prueba antes de guardar y queda cifrada.</p>
      )}
      {abierto && (
        <div className="fila-campo">
          <input className="input" type="password" autoComplete="off" placeholder="sk-ant-…" value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Clave de Anthropic" />
          <button type="button" className="btn btn-pri" disabled={pendiente || !clave.trim()} onClick={() => empezar(async () => {
            setError(null)
            const r = await guardarClaveIA(clave, modelo)
            if ('error' in r) setError(r.error)
            else { setClave(''); setAbierto(false); router.refresh() }
          })}>{pendiente ? 'Probando…' : 'Probar y guardar'}</button>
        </div>
      )}
      {error && <span className="texto-error" role="alert">{error}</span>}
    </div>
  )
}
