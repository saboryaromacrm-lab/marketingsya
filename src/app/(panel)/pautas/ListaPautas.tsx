'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { ConfirmarGasto } from '@/components/pautas/ConfirmarGasto'
import type { EstadoPauta } from '@/lib/db/esquema'
import { diasEntre, ESTADO_FINAL, ETIQUETA_PAUTA, pesos, totalPauta } from '@/lib/pautas/reglas'
import { actualizarPautas, nuevoPresupuesto, pausar, reanudar, terminar } from './acciones'
import { imagenMini } from '@/lib/miniaturas'

export type FilaPauta = {
  id: number
  titulo: string
  objetivo: string
  publico: string
  fechas: string
  desde: string
  hasta: string
  porDia: number
  gastado: number
  total: number
  resultado: { texto: string; costo: string | null } | null
  alcance: number
  estado: EstadoPauta
  motivo: string | null
  miniatura: string | null
}

type Ajustes = { iva: number; escribirDesde: number; minDiario: number | null }

export function ListaPautas({ filas, nueva, sincronizado, hoy, ajustes }: { filas: FilaPauta[]; nueva: number | null; sincronizado: string | null; hoy: string; ajustes: Ajustes }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [actualizando, empezarActualizar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<FilaPauta | null>(null)
  const pidio = useRef(false)

  // Al abrir la pantalla se piden los números a Meta (si pasaron más de 15 minutos desde la última vez)
  const actualizar = (forzar: boolean) => empezarActualizar(async () => {
    const r = await actualizarPautas(forzar)
    if (r.error) setError(`No se pudieron actualizar los números: ${r.error}`)
    if (r.actualizadas || forzar) router.refresh()
  })
  useEffect(() => {
    if (pidio.current) return
    pidio.current = true
    if (filas.some((f) => !ESTADO_FINAL(f.estado))) actualizar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Mientras haya pautas en revisión, se vuelve a mirar cada 2 minutos
  useEffect(() => {
    if (!filas.some((f) => f.estado === 'en_revision' || f.estado === 'creando')) return
    const t = setInterval(() => actualizar(true), 120_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas])

  const accion = (fn: () => Promise<{ ok: true } | { error: string }>) => empezar(async () => {
    setError(null)
    const r = await fn()
    if ('error' in r) setError(r.error)
    router.refresh()
  })

  return (
    <>
      {error && <span className="texto-error" role="alert">{error}</span>}
      {!filas.length ? (
        <div className="vacio"><b>Todavía no hay pautas acá.</b> Elegí un posteo publicado y tocá «Promocionar».</div>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla-publicaciones tabla-pautas">
            <thead><tr><th aria-label="Imagen" /><th>Pauta</th><th>Público</th><th>Fechas</th><th>Gastado</th><th>Resultados</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {filas.map((f) => {
                const e = ETIQUETA_PAUTA[f.estado]
                const pct = f.total > 0 ? Math.min(100, Math.round((f.gastado / f.total) * 100)) : 0
                const viva = !ESTADO_FINAL(f.estado) && f.estado !== 'creando'
                return (
                  <tr key={f.id} className={nueva === f.id ? 'fila-nueva' : ''}>
                    <td>{f.miniatura ? <img className="mini-publicacion" {...imagenMini(f.miniatura, 48)} alt="" loading="lazy" /> : <span className="mini-publicacion mini-publicacion-vacia"><Icono nombre="campaign" /></span>}</td>
                    <td><b>{f.titulo}</b><div className="texto-chico">{f.objetivo}</div></td>
                    <td className="texto-chico">{f.publico}</td>
                    <td className="celda-cuando">{f.fechas}</td>
                    <td><b>{pesos(f.gastado)}</b> <span className="texto-chico">de {pesos(f.total)}</span><div className="barra-gasto"><div style={{ width: `${pct}%` }} /></div></td>
                    <td>{f.resultado && (f.gastado > 0 || f.alcance > 0) ? <><b>{f.resultado.texto}</b><div className="texto-chico">{[f.resultado.costo, f.alcance ? `${f.alcance.toLocaleString('es-AR')} personas` : null].filter(Boolean).join(' · ')}</div></> : <span className="texto-chico">{f.estado === 'error' || f.estado === 'rechazada' ? '—' : 'Todavía sin datos'}</span>}</td>
                    <td><span className={`chip ${e.clase}`}>{e.texto}</span>{f.motivo && <div className="texto-chico texto-error-suave">{f.motivo}</div>}</td>
                    <td>
                      <div className="acciones-publicacion">
                        {viva && (f.estado === 'activa' || f.estado === 'programada' || f.estado === 'con_problemas') && <button className="btn btn-chico" disabled={pendiente} onClick={() => accion(() => pausar(f.id))}>Pausar</button>}
                        {viva && f.estado === 'pausada' && <button className="btn btn-chico" disabled={pendiente} onClick={() => accion(() => reanudar(f.id))}>Reanudar</button>}
                        {viva && f.estado !== 'en_revision' && <button className="btn btn-chico" disabled={pendiente} onClick={() => setEditando(f)}>Cambiar presupuesto</button>}
                        {viva && <button className="btn btn-chico" disabled={pendiente} onClick={() => { if (confirm(f.estado === 'en_revision' ? `¿Cancelar «${f.titulo}»? No se va a gastar nada.` : `¿Terminar «${f.titulo}» ahora? Deja de gastar y no se puede reanudar desde la plataforma.`)) accion(() => terminar(f.id)) }}>{f.estado === 'en_revision' ? 'Cancelar' : 'Terminar'}</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="texto-chico">
        {sincronizado ? `Números de Meta de ${sincronizado}` : 'Los números se piden a Meta al abrir esta pantalla'} ·{' '}
        <button type="button" className="enlace texto-chico" disabled={actualizando} onClick={() => actualizar(true)}>{actualizando ? 'Actualizando…' : 'Actualizar ahora'}</button>.
        Meta puede tardar unas horas en mostrar lo gastado.
      </p>
      {editando && <EditarPresupuesto f={editando} hoy={hoy} ajustes={ajustes} alCerrar={() => { setEditando(null); router.refresh() }} />}
    </>
  )
}

function EditarPresupuesto({ f, hoy, ajustes, alCerrar }: { f: FilaPauta; hoy: string; ajustes: Ajustes; alCerrar: () => void }) {
  const [porDia, setPorDia] = useState(f.porDia)
  const [hasta, setHasta] = useState(f.hasta)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const total = totalPauta(porDia, diasEntre(f.desde, hasta))
  const problema = hasta < hoy ? 'La fecha de fin ya pasó.' : !total ? 'Revisá las fechas.' : ajustes.minDiario && porDia < ajustes.minDiario ? `Meta pide como mínimo ${pesos(ajustes.minDiario)} por día.` : total <= f.gastado ? `Ya gastó ${pesos(f.gastado)}: el total tiene que ser mayor.` : null
  if (confirmando) {
    return (
      <ConfirmarGasto
        titulo="¿Confirmás el nuevo presupuesto?"
        total={total}
        iva={ajustes.iva}
        escribirDesde={ajustes.escribirDesde}
        pendiente={pendiente}
        detalle={<>«{f.titulo}»: {pesos(porDia)} por día hasta el {hasta.slice(8, 10)}/{hasta.slice(5, 7)} (antes {pesos(f.total)}). Ya gastó {pesos(f.gastado)}.</>}
        alCancelar={() => setConfirmando(false)}
        alConfirmar={() => empezar(async () => {
          const r = await nuevoPresupuesto(f.id, porDia, hasta, total)
          if ('error' in r) { setError(r.error); setConfirmando(false) }
          else alCerrar()
        })}
      />
    )
  }
  return (
    <div className="dialogo-fondo" role="dialog" aria-modal="true" aria-label="Cambiar presupuesto">
      <div className="dialogo">
        <h2 className="titulo-seccion">Cambiar presupuesto · {f.titulo}</h2>
        <div className="promocionar-dos">
          <label className="campo"><span className="rotulo-columna">Por día ($)</span><input className="input" inputMode="numeric" value={porDia.toLocaleString('es-AR')} onChange={(e) => setPorDia(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} /></label>
          <label className="campo"><span className="rotulo-columna">Hasta</span><input className="input" type="date" value={hasta} min={hoy} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
        <div className="promocionar-total"><span>Nuevo total máximo</span><b>{pesos(total)}</b></div>
        <p className="texto-chico">Antes: {pesos(f.total)} · ya gastó {pesos(f.gastado)} · empezó el {f.desde.slice(8, 10)}/{f.desde.slice(5, 7)}.</p>
        {(problema || error) && <span className="texto-error" role="alert">{problema ?? error}</span>}
        <div className="fila-chips dialogo-botones">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button type="button" className="btn btn-pri" disabled={!!problema || total === f.total && hasta === f.hasta} onClick={() => setConfirmando(true)}>Revisar</button>
        </div>
      </div>
    </div>
  )
}
