'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { ConfirmarGasto } from '@/components/pautas/ConfirmarGasto'
import { OBJETIVOS_PAUTA, UBICACIONES_PAUTA, type ObjetivoPauta, type UbicacionesPauta } from '@/lib/configuracion-tipos'
import { diasEntre, pesos, problemasPresupuesto, sumarDias, totalPauta } from '@/lib/pautas/reglas'
import { lanzarPauta } from '../acciones'
import { imagenMini } from '@/lib/miniaturas'

type Props = {
  publicacion: { id: number; titulo: string; texto: string; imagen: string | null; publicadaEn: string | null; instagram: string | null; facebook: string | null }
  inicial: { objetivo: ObjetivoPauta; publicoId: string; porDia: number; dias: number }
  publicos: { id: string; nombre: string; resumen: string }[]
  ubicaciones: UbicacionesPauta
  hoy: string
  cuenta: { nombre: string; moneda: string; activa: boolean; minDiario: number | null; whatsapp: string | null } | null
  metaConectada: boolean
  tope: { tope: number; comprometido: number; cortar: boolean }
  ajustes: { iva: number; escribirDesde: number; whatsapp: string; web: string }
}

type Chequeo = { ok: boolean; texto: ReactNode; aviso?: boolean }
const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const fechaLarga = (f: string) => `${DIA[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${f.slice(8, 10)}/${f.slice(5, 7)}`

export function Promocionar({ publicacion, inicial, publicos, ubicaciones, hoy, cuenta, metaConectada, tope, ajustes }: Props) {
  const router = useRouter()
  const [objetivo, setObjetivo] = useState(inicial.objetivo)
  const [publicoId, setPublicoId] = useState(inicial.publicoId)
  const [porDia, setPorDia] = useState(inicial.porDia)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(sumarDias(hoy, inicial.dias - 1))
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const dias = diasEntre(desde, hasta)
  const total = totalPauta(porDia, dias)
  const queda = Math.max(0, tope.tope - tope.comprometido)
  const pct = tope.tope > 0 ? Math.min(100, Math.round((tope.comprometido / tope.tope) * 100)) : 0
  const publico = publicos.find((p) => p.id === publicoId) ?? publicos[0]
  const sinIg = publicacion.instagram == null

  const chequeos: Chequeo[] = []
  if (!metaConectada) chequeos.push({ ok: false, texto: <>Meta no está conectado: <Link prefetch={false} href="/configuracion/meta">cargá el token</Link></> })
  else if (!cuenta) chequeos.push({ ok: false, texto: <>Falta detectar la cuenta publicitaria: <Link prefetch={false} href="/configuracion/pautas">Configuración › Pautas</Link></> })
  else {
    chequeos.push(cuenta.moneda !== 'ARS' ? { ok: false, texto: `La cuenta publicitaria está en ${cuenta.moneda}: tiene que ser en pesos` } : !cuenta.activa ? { ok: false, texto: 'La cuenta publicitaria no está activa en Meta (revisá el medio de pago)' } : { ok: true, texto: `Cuenta publicitaria conectada (${cuenta.nombre} · ARS)` })
    if (objetivo === 'mensajes') chequeos.push(cuenta.whatsapp ? { ok: true, texto: 'WhatsApp Business vinculado a la página' } : { ok: true, aviso: true, texto: 'No se pudo confirmar el WhatsApp vinculado a la página: si no lo está, Meta va a rechazar la pauta' })
  }
  if (sinIg && objetivo !== 'alcance') chequeos.push({ ok: false, texto: 'Este posteo salió solo en Facebook: con «Mensajes» o «Tráfico» no se puede. Elegí «Alcance».' })
  for (const p of problemasPresupuesto({ porDia, desde, hasta, hoy, minDiario: cuenta?.minDiario ?? null })) chequeos.push({ ok: false, texto: p })
  if (cuenta?.minDiario && porDia >= cuenta.minDiario) chequeos.push({ ok: true, texto: 'Por día está arriba del mínimo de Meta' })
  if (tope.cortar) chequeos.push(total <= queda ? { ok: true, texto: 'Entra en el tope del mes' } : { ok: false, texto: `Se pasa del tope del mes: quedan ${pesos(queda)}` })
  const bloquea = chequeos.some((c) => !c.ok)

  const cambiarDias = (n: number) => { const d = Math.max(1, Math.min(90, n || 1)); setHasta(sumarDias(desde, d - 1)) }
  const cambiarDesde = (f: string) => { const d = dias || 1; setDesde(f); if (/^\d{4}-\d{2}-\d{2}$/.test(f)) setHasta(sumarDias(f, d - 1)) }

  function lanzar() {
    empezar(async () => {
      setError(null)
      const r = await lanzarPauta({ publicacionId: publicacion.id, objetivo, publicoId, porDia, desde, hasta, confirmado: total })
      if ('error' in r) { setError(r.error); setConfirmando(false) }
      else router.push(`/pautas?nueva=${r.id}`)
    })
  }

  return (
    <div className="contenido">
      <Cabecera
        titulo={<>Promocionar · {publicacion.titulo} <span className="chip chip-titulo">PAUTA</span></>}
        subtitulo="Elegí el objetivo, el público y cuánto gastar. Nada se gasta sin tu confirmación."
        miga={[{ texto: 'Pautas', href: '/pautas' }, { texto: `Promocionar · ${publicacion.titulo}` }]}
      />
      <div className="promocionar">
        <section className="tarjeta" aria-label="Lo que se pauta">
          <span className="rotulo-columna">Lo que se pauta</span>
          {publicacion.imagen && <img className="promocionar-imagen" {...imagenMini(publicacion.imagen, 380)} alt={publicacion.titulo} />}
          <div className="fila-chips">
            <span className="chip chip-ok"><Icono nombre="check_circle" tamano={14} /> Publicado{publicacion.publicadaEn ? ` el ${new Date(publicacion.publicadaEn).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Cordoba' })}` : ''}</span>
            {publicacion.instagram && <a className="enlace texto-chico" href={publicacion.instagram} target="_blank" rel="noreferrer">Ver en Instagram</a>}
            {publicacion.facebook && <a className="enlace texto-chico" href={publicacion.facebook} target="_blank" rel="noreferrer">Ver en Facebook</a>}
          </div>
          {publicacion.texto && <div className="promocionar-texto">{publicacion.texto}</div>}
          <p className="texto-chico">El anuncio usa el mismo posteo{sinIg ? ' de Facebook' : ' de Instagram (se muestra también en Facebook)'}, así suma los me gusta y comentarios que ya tiene.</p>
        </section>

        <section className="tarjeta" aria-label="Objetivo y público">
          <span className="rotulo-columna">Objetivo</span>
          <div className="objetivos" role="radiogroup" aria-label="Objetivo">
            {(Object.keys(OBJETIVOS_PAUTA) as ObjetivoPauta[]).map((k) => {
              const apagado = sinIg && k !== 'alcance'
              const detalle = k === 'mensajes' ? `Botón «Enviar mensaje» al ${ajustes.whatsapp}. Mide cuántas conversaciones empiezan.` : k === 'trafico' ? `Botón «Comprar» a ${ajustes.web} (con marca de seguimiento). Mide clics.` : OBJETIVOS_PAUTA[k].detalle
              return (
                <label key={k} className={`objetivo ${objetivo === k ? 'objetivo-activo' : ''} ${apagado ? 'objetivo-apagado' : ''}`}>
                  <input type="radio" name="objetivo" checked={objetivo === k} disabled={apagado} onChange={() => setObjetivo(k)} />
                  <span><b>{OBJETIVOS_PAUTA[k].nombre}</b><small>{apagado ? 'Solo para posteos que salieron en Instagram.' : detalle}</small></span>
                </label>
              )
            })}
          </div>
          <label className="campo">
            <span className="rotulo-columna">Público</span>
            <select className="input" value={publicoId} onChange={(e) => setPublicoId(e.target.value)}>
              {publicos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {publico && <span className="texto-chico">{publico.resumen}</span>}
          </label>
          <div className="campo">
            <span className="rotulo-columna">Dónde se muestra</span>
            <span className="texto-chico">{UBICACIONES_PAUTA[ubicaciones]} · <Link prefetch={false} href="/configuracion/pautas">cambiar</Link></span>
          </div>
        </section>

        <section className="tarjeta" aria-label="Presupuesto">
          <span className="rotulo-columna">Presupuesto</span>
          <div className="promocionar-dos">
            <label className="campo"><span className="rotulo-columna">Por día ($)</span><input className="input" inputMode="numeric" value={porDia.toLocaleString('es-AR')} onChange={(e) => setPorDia(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} /></label>
            <label className="campo"><span className="rotulo-columna">Días</span><input className="input" inputMode="numeric" value={dias || ''} onChange={(e) => cambiarDias(Number(e.target.value))} /></label>
          </div>
          <div className="promocionar-dos">
            <label className="campo"><span className="rotulo-columna">Desde</span><input className="input" type="date" value={desde} min={hoy} onChange={(e) => cambiarDesde(e.target.value)} /></label>
            <label className="campo"><span className="rotulo-columna">Hasta</span><input className="input" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
          <div className="promocionar-total"><span>Total máximo</span><b>{pesos(total)}</b></div>
          <p className="texto-chico">Nunca gasta más que eso: la pauta termina sola el {hasta.slice(8, 10)}/{hasta.slice(5, 7)}. Meta suma impuestos: con IVA, aprox. {pesos(total * (1 + ajustes.iva / 100))}.</p>
          <div>
            <div className="fila-separada"><span className="texto-chico">Tope del mes: {pesos(tope.comprometido)} de {pesos(tope.tope)}</span><span className="texto-chico">quedan {pesos(queda)}</span></div>
            <div className={`medidor ${pct >= 100 ? 'medidor-lleno' : pct >= 80 ? 'medidor-aviso' : ''}`}><div style={{ width: `${pct}%` }} /></div>
          </div>
          <span className="rotulo-columna promocionar-rotulo">Revisión</span>
          <ul className="lista-pruebas">
            {chequeos.map((c, i) => <li key={i} className={!c.ok ? 'prueba-mal' : c.aviso ? 'prueba-aviso' : ''}><Icono nombre={!c.ok ? 'error' : c.aviso ? 'warning' : 'check_circle'} tamano={18} />{c.texto}</li>)}
          </ul>
          <button type="button" className="btn btn-pri publicar-boton" disabled={bloquea || pendiente} onClick={() => { setError(null); setConfirmando(true) }}><Icono nombre="campaign" />Revisar y lanzar</button>
          {error && <span className="texto-error" role="alert">{error}</span>}
          <p className="texto-chico">Meta revisa el anuncio (de minutos a 24 h). Arranca solo cuando lo aprueban.</p>
        </section>
      </div>
      {confirmando && (
        <ConfirmarGasto
          total={total}
          iva={ajustes.iva}
          escribirDesde={ajustes.escribirDesde}
          pendiente={pendiente}
          detalle={<>{pesos(porDia)} por día, del {fechaLarga(desde)} al {fechaLarga(hasta)} · {OBJETIVOS_PAUTA[objetivo].nombre} · {publico?.nombre}.</>}
          alConfirmar={lanzar}
          alCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
