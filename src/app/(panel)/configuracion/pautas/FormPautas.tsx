'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { OBJETIVOS_PAUTA, UBICACIONES_PAUTA, type Config, type ObjetivoPauta, type PublicoPauta, type UbicacionesPauta } from '@/lib/configuracion-tipos'
import type { Publicidad } from '@/lib/meta/anuncios'
import { pesos, resumenPublico } from '@/lib/pautas/reglas'
import { Campo, Interruptor, ListaEditable, Segmentado, useGuardar } from '../Formularios'
import { detectarCuentaPublicitaria, probarPublico } from '../acciones-pautas'

type Props = { inicial: Config['pautas']; metaConectada: boolean; finToken: string | null; publicidad: Publicidad | null; mes: { comprometido: number; gastado: number } }

const numero = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

export function FormPautas({ inicial, metaConectada, finToken, publicidad, mes }: Props) {
  const [v, setV] = useState(inicial)
  const set = <K extends keyof Config['pautas']>(k: K, x: Config['pautas'][K]) => setV((p) => ({ ...p, [k]: x }))
  const presupuesto = useGuardar('pautas'), publicos = useGuardar('pautas'), alPautar = useGuardar('pautas')
  const pct = v.topeMensual > 0 ? Math.min(100, Math.round((mes.comprometido / v.topeMensual) * 100)) : 0
  return (
    <>
      <div className="grilla-config">
        <section className="tarjeta">
          <h2 className="titulo-seccion">Cuenta publicitaria</h2>
          <Cuenta metaConectada={metaConectada} finToken={finToken} publicidad={publicidad} />
        </section>

        <section className="tarjeta">
          <h2 className="titulo-seccion">Presupuesto</h2>
          <div>
            <div className="fila-separada"><span className="texto-chico">Este mes: {pesos(mes.comprometido)} comprometidos ({pesos(mes.gastado)} gastados)</span><span className="texto-chico">{pct} %</span></div>
            <div className={`medidor ${pct >= 100 ? 'medidor-lleno' : pct >= 80 ? 'medidor-aviso' : ''}`}><div style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="form-columnas">
            <Campo rotulo="Tope por mes ($)" ayuda="Sin impuestos."><input className="input" inputMode="numeric" value={v.topeMensual.toLocaleString('es-AR')} onChange={(e) => set('topeMensual', numero(e.target.value))} /></Campo>
            <Campo rotulo="Por día de entrada ($)"><input className="input" inputMode="numeric" value={v.porDia.toLocaleString('es-AR')} onChange={(e) => set('porDia', numero(e.target.value))} /></Campo>
            <Campo rotulo="Días de entrada"><input className="input" inputMode="numeric" value={v.dias} onChange={(e) => set('dias', numero(e.target.value))} /></Campo>
          </div>
          <div className="form-columnas">
            <Campo rotulo="Pedir escribir el monto desde ($)" ayuda="Para confirmar pautas grandes hay que tipear el total."><input className="input" inputMode="numeric" value={v.escribirDesde.toLocaleString('es-AR')} onChange={(e) => set('escribirDesde', numero(e.target.value))} /></Campo>
            <Campo rotulo="IVA aproximado (%)" ayuda="Solo para mostrar cuánto te cobra Meta con impuestos."><input className="input" inputMode="decimal" value={v.iva} onChange={(e) => set('iva', Number(e.target.value.replace(',', '.')) || 0)} /></Campo>
          </div>
          <Interruptor valor={v.cortar} alCambiar={(x) => set('cortar', x)} texto={<><b>Cortar al llegar al tope</b><span className="texto-chico"> No deja lanzar ni agrandar pautas que pasen el tope del mes.</span></>} />
          <p className="texto-chico">Te recomendamos poner el mismo límite en la cuenta publicitaria de Meta (Facturación › Límite de gasto de la cuenta), como doble seguro.</p>
          {presupuesto.pie(() => presupuesto.guardar({ topeMensual: v.topeMensual, porDia: v.porDia, dias: v.dias, escribirDesde: v.escribirDesde, iva: v.iva, cortar: v.cortar }))}
        </section>
      </div>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Públicos guardados</h2>
        <Publicos publicos={v.publicos} entrada={v.publicoEntrada} alCambiar={(publicos, publicoEntrada) => setV((p) => ({ ...p, publicos, publicoEntrada }))} metaConectada={metaConectada} />
        {publicos.pie(() => publicos.guardar({ publicos: v.publicos, publicoEntrada: v.publicoEntrada }, (c) => setV((p) => ({ ...p, publicos: c.pautas.publicos, publicoEntrada: c.pautas.publicoEntrada }))), 'Guardar públicos')}
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Al pautar</h2>
        <div className="form-columnas">
          <Campo rotulo="Objetivo de entrada">
            <select className="input" value={v.objetivo} onChange={(e) => set('objetivo', e.target.value as ObjetivoPauta)}>
              {(Object.keys(OBJETIVOS_PAUTA) as ObjetivoPauta[]).map((k) => <option key={k} value={k}>{OBJETIVOS_PAUTA[k].nombre}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Dónde se muestra">
            <select className="input" value={v.ubicaciones} onChange={(e) => set('ubicaciones', e.target.value as UbicacionesPauta)}>
              {(Object.keys(UBICACIONES_PAUTA) as UbicacionesPauta[]).map((k) => <option key={k} value={k}>{UBICACIONES_PAUTA[k]}</option>)}
            </select>
          </Campo>
        </div>
        <Interruptor valor={v.utm} alCambiar={(x) => set('utm', x)} texto={<><b>Marca de seguimiento en el enlace a la tienda</b><span className="texto-chico"> utm_source=meta y el nombre de la pauta, para saber de dónde vino cada visita.</span></>} />
        {alPautar.pie(() => alPautar.guardar({ objetivo: v.objetivo, ubicaciones: v.ubicaciones, utm: v.utm }))}
      </section>
    </>
  )
}

function Cuenta({ metaConectada, finToken, publicidad }: { metaConectada: boolean; finToken: string | null; publicidad: Publicidad | null }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const detectar = (preferida?: string) => empezar(async () => {
    setError(null)
    const r = await detectarCuentaPublicitaria(preferida)
    if ('error' in r) setError(r.error)
    router.refresh()
  })
  if (!metaConectada) return <p className="texto-suave">Primero conectá Meta en <Link href="/configuracion/meta">Configuración › Meta</Link>. Las pautas usan el mismo token.</p>
  return (
    <div className="campo">
      {publicidad ? (
        <>
          <div className="fila-chips">
            <span className="chip chip-ok"><Icono nombre="check_circle" tamano={14} /> Conectada</span>
            <span className="texto-suave">Con el mismo token de Meta (···{finToken})</span>
          </div>
          <div className={`cuenta-meta ${publicidad.moneda !== 'ARS' || !publicidad.activa ? 'cuenta-meta-falta' : ''}`}>
            <Icono nombre="account_balance_wallet" />
            <div>
              <b>{publicidad.nombre}</b>
              {publicidad.cuentas.length > 1 && (
                <select className="input" value={publicidad.id} aria-label="Cuenta publicitaria" onChange={(e) => detectar(e.target.value)}>
                  {publicidad.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.moneda}</option>)}
                </select>
              )}
              <div className="texto-chico">
                {publicidad.moneda === 'ARS' ? 'Pesos argentinos' : `Moneda ${publicidad.moneda}: la plataforma trabaja en pesos, usá una cuenta en ARS`}
                {publicidad.zona ? ` · ${publicidad.zona}` : ''}{publicidad.activa ? '' : ' · la cuenta no está activa en Meta'}
              </div>
            </div>
          </div>
          <div className={`cuenta-meta ${publicidad.whatsapp ? '' : 'cuenta-meta-falta'}`}>
            <Icono nombre="chat" />
            <div>
              <b>WhatsApp Business</b>
              <div className="texto-chico">{publicidad.whatsapp ? `${publicidad.whatsapp} · vinculado a la página` : 'No se pudo confirmar que esté vinculado a la página. Para los anuncios de mensajes, vinculalo en Meta Business Suite › Configuración › WhatsApp.'}</div>
            </div>
          </div>
          {publicidad.minDiario != null && <p className="texto-chico">Mínimo por día que pide Meta en esta cuenta: <b>{pesos(publicidad.minDiario)}</b>.</p>}
          <button type="button" className="btn btn-chico boton-izquierda" disabled={pendiente} onClick={() => detectar()}><Icono nombre={pendiente ? 'sync' : 'refresh'} tamano={16} className={pendiente ? 'girando' : ''} />{pendiente ? 'Buscando…' : 'Detectar de nuevo'}</button>
        </>
      ) : (
        <>
          <p className="texto-suave">Buscamos la cuenta publicitaria con el token de Meta. Tiene que estar asignada al usuario del sistema y el token tiene que tener los permisos de anuncios (ads_management y ads_read).</p>
          <button type="button" className="btn btn-pri boton-izquierda" disabled={pendiente} onClick={() => detectar()}><Icono nombre={pendiente ? 'sync' : 'search'} className={pendiente ? 'girando' : ''} />{pendiente ? 'Buscando…' : 'Detectar cuenta publicitaria'}</button>
        </>
      )}
      {error && <span className="texto-error" role="alert">{error}</span>}
    </div>
  )
}

const NUEVO: PublicoPauta = { id: '', nombre: 'Nuevo público', zona: { tipo: 'radio', nombre: 'Formosa Capital', lat: -26.1775, lng: -58.1781, km: 15 }, edadMin: 18, edadMax: 65, generos: 'todos', intereses: [], advantage: true }

function Publicos({ publicos, entrada, alCambiar, metaConectada }: { publicos: PublicoPauta[]; entrada: string; alCambiar: (p: PublicoPauta[], entrada: string) => void; metaConectada: boolean }) {
  const [editando, setEditando] = useState<number | null>(null)
  const cambiar = (i: number, p: PublicoPauta) => alCambiar(publicos.map((x, k) => (k === i ? p : x)), entrada)
  return (
    <div className="campo">
      {publicos.map((p, i) => (
        <div key={`${p.id}-${i}`} className="publico-guardado">
          <div className="publico-cabeza">
            <Icono nombre={p.zona.tipo === 'region' ? 'storefront' : 'groups'} />
            <div className="publico-texto">
              <b>{p.nombre}</b> {p.id === entrada && <span className="chip">de entrada</span>}
              <div className="texto-chico">{resumenPublico(p)}</div>
            </div>
            <div className="fila-chips">
              {p.id !== entrada && <button type="button" className="enlace texto-chico" onClick={() => alCambiar(publicos, p.id)}>Usar de entrada</button>}
              <button type="button" className="btn btn-chico" onClick={() => setEditando(editando === i ? null : i)}>{editando === i ? 'Listo' : 'Editar'}</button>
              {publicos.length > 1 && <button type="button" className="btn btn-chico" aria-label={`Borrar ${p.nombre}`} onClick={() => { if (confirm(`¿Borrar el público «${p.nombre}»?`)) { const resto = publicos.filter((_, k) => k !== i); alCambiar(resto, p.id === entrada ? resto[0].id : entrada); setEditando(null) } }}><Icono nombre="delete" tamano={16} /></button>}
            </div>
          </div>
          {editando === i && <EditorPublico p={p} alCambiar={(x) => cambiar(i, x)} metaConectada={metaConectada} />}
        </div>
      ))}
      {publicos.length < 12 && <button type="button" className="btn btn-chico boton-izquierda" onClick={() => { alCambiar([...publicos, { ...NUEVO, id: `publico-${Date.now().toString(36)}` }], entrada); setEditando(publicos.length) }}><Icono nombre="add" tamano={16} />Nuevo público</button>}
      <p className="texto-chico">Los cambios se guardan con «Guardar públicos». Los intereses se buscan en Meta al lanzar cada pauta.</p>
    </div>
  )
}

function EditorPublico({ p, alCambiar, metaConectada }: { p: PublicoPauta; alCambiar: (p: PublicoPauta) => void; metaConectada: boolean }) {
  const [prueba, setPrueba] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const z = p.zona
  return (
    <div className="publico-editor">
      <div className="form-columnas">
        <Campo rotulo="Nombre"><input className="input" value={p.nombre} maxLength={40} onChange={(e) => alCambiar({ ...p, nombre: e.target.value })} /></Campo>
        <div className="campo">
          <span className="rotulo-columna">Zona</span>
          <Segmentado valor={z.tipo} opciones={[['radio', 'Radio alrededor de un punto'], ['region', 'Provincia']]} alCambiar={(t) => alCambiar({ ...p, zona: t === 'region' ? { tipo: 'region', nombre: 'Formosa' } : { ...NUEVO.zona } })} />
        </div>
      </div>
      {z.tipo === 'radio' ? (
        <div className="form-columnas">
          <Campo rotulo="Lugar (nombre)"><input className="input" value={z.nombre} onChange={(e) => alCambiar({ ...p, zona: { ...z, nombre: e.target.value } })} /></Campo>
          <Campo rotulo="Latitud" ayuda="Del mapa (Google Maps: clic derecho en el punto)."><input className="input" inputMode="decimal" value={z.lat} onChange={(e) => alCambiar({ ...p, zona: { ...z, lat: Number(e.target.value.replace(',', '.')) || 0 } })} /></Campo>
          <Campo rotulo="Longitud"><input className="input" inputMode="decimal" value={z.lng} onChange={(e) => alCambiar({ ...p, zona: { ...z, lng: Number(e.target.value.replace(',', '.')) || 0 } })} /></Campo>
          <Campo rotulo="Radio (km)"><input className="input" inputMode="numeric" value={z.km} onChange={(e) => alCambiar({ ...p, zona: { ...z, km: Number(e.target.value) || 1 } })} /></Campo>
        </div>
      ) : (
        <div className="form-columnas"><Campo rotulo="Provincia"><input className="input" value={z.nombre} onChange={(e) => alCambiar({ ...p, zona: { tipo: 'region', nombre: e.target.value } })} /></Campo></div>
      )}
      <div className="form-columnas">
        <Campo rotulo="Edad desde"><input className="input" inputMode="numeric" value={p.edadMin} onChange={(e) => alCambiar({ ...p, edadMin: Number(e.target.value) || 18 })} /></Campo>
        <Campo rotulo="Edad hasta" ayuda="65 = 65 o más."><input className="input" inputMode="numeric" value={p.edadMax} disabled={p.advantage} onChange={(e) => alCambiar({ ...p, edadMax: Number(e.target.value) || 65 })} /></Campo>
        <div className="campo"><span className="rotulo-columna">Géneros</span><Segmentado valor={p.generos} opciones={[['todos', 'Todos'], ['mujeres', 'Mujeres'], ['hombres', 'Hombres']]} alCambiar={(g) => alCambiar({ ...p, generos: g })} /></div>
      </div>
      <div className="campo"><span className="rotulo-columna">Intereses</span><ListaEditable valores={p.intereses} alCambiar={(x) => alCambiar({ ...p, intereses: x })} placeholder="Sumar interés…" /></div>
      <Interruptor valor={p.advantage} alCambiar={(x) => alCambiar({ ...p, advantage: x, edadMax: x ? 65 : p.edadMax, edadMin: x ? Math.min(p.edadMin, 25) : p.edadMin })} texto={<><b>Advantage+ (recomendado)</b><span className="texto-chico"> Meta usa la zona, la edad y los intereses como punto de partida y amplía solo. Con esto Meta pide edad hasta 65+ y desde 25 como mucho.</span></>} />
      <div className="fila-chips">
        <button type="button" className="btn btn-chico" disabled={!metaConectada || pendiente} onClick={() => empezar(async () => {
          setError(null); setPrueba(null)
          const r = await probarPublico(p)
          if ('error' in r) setError(r.error)
          else setPrueba(`Zona: ${r.zona}. Intereses que encontró Meta: ${r.encontrados.join(', ') || 'ninguno'}.${r.faltan.length ? ` Sin coincidencia exacta: ${r.faltan.join(', ')}.` : ''}`)
        })}><Icono nombre={pendiente ? 'sync' : 'travel_explore'} tamano={16} className={pendiente ? 'girando' : ''} />{pendiente ? 'Probando…' : 'Probar en Meta'}</button>
        {prueba && <span className="texto-chico">{prueba}</span>}
        {error && <span className="texto-error">{error}</span>}
      </div>
    </div>
  )
}
