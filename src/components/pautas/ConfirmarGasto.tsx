'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icono } from '@/components/Icono'
import { pesos } from '@/lib/pautas/reglas'

/**
 * Cuadro para confirmar un gasto: muestra el máximo y, desde cierto monto, pide escribirlo.
 * Nada se manda a Meta hasta que Lucas confirma acá.
 */
export function ConfirmarGasto({ titulo = '¿Confirmás el gasto?', total, iva, escribirDesde, detalle, pendiente, alConfirmar, alCancelar }: {
  titulo?: string
  total: number
  iva: number
  escribirDesde: number
  detalle: ReactNode
  pendiente: boolean
  alConfirmar: () => void
  alCancelar: () => void
}) {
  const [escrito, setEscrito] = useState('')
  const pideEscribir = total >= escribirDesde
  const coincide = Number(escrito.replace(/[^\d]/g, '')) === Math.round(total)
  const cancelar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelar.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pendiente) alCancelar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [alCancelar, pendiente])
  return (
    <div className="dialogo-fondo" role="dialog" aria-modal="true" aria-labelledby="confirmar-gasto-titulo">
      <div className="dialogo">
        <h2 className="titulo-seccion" id="confirmar-gasto-titulo">{titulo}</h2>
        <div>Vas a gastar como máximo</div>
        <div className="dialogo-monto">{pesos(total)}</div>
        <div className="texto-suave">{detalle}</div>
        <div className="texto-suave">Meta suma impuestos (con IVA, aprox. {pesos(total * (1 + iva / 100))}) y te lo cobra con la tarjeta de la cuenta publicitaria.</div>
        {pideEscribir && (
          <label className="campo">
            <span className="rotulo-columna">Para confirmar, escribí el monto ({Math.round(total).toLocaleString('es-AR')})</span>
            <input className="input" inputMode="numeric" autoComplete="off" value={escrito} onChange={(e) => setEscrito(e.target.value)} aria-label="Monto para confirmar" />
          </label>
        )}
        <div className="fila-chips dialogo-botones">
          <button ref={cancelar} type="button" className="btn" disabled={pendiente} onClick={alCancelar}>Cancelar</button>
          <button type="button" className="btn btn-pri" disabled={pendiente || (pideEscribir && !coincide)} onClick={alConfirmar}>
            <Icono nombre={pendiente ? 'sync' : 'check'} className={pendiente ? 'girando' : ''} />
            {pendiente ? 'Enviando a Meta…' : `Sí, gastar hasta ${pesos(total)}`}
          </button>
        </div>
        {!pideEscribir && <p className="texto-chico">Desde {pesos(escribirDesde)} te pedimos escribir el monto para confirmar.</p>}
      </div>
    </div>
  )
}
