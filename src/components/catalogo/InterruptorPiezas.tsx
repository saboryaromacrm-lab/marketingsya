'use client'

import { useState, useTransition } from 'react'
import { cambiarExclusion } from '@/app/(panel)/catalogo/acciones'

export function InterruptorPiezas({ productoId, excluido }: { productoId: number; excluido: boolean }) {
  const [usar, setUsar] = useState(!excluido)
  const [pendiente, empezar] = useTransition()
  return (
    <label className="interruptor">
      <input
        type="checkbox"
        role="switch"
        checked={usar}
        disabled={pendiente}
        onChange={(e) => {
          const nuevo = e.target.checked
          setUsar(nuevo)
          empezar(() => cambiarExclusion(productoId, !nuevo))
        }}
      />
      <span className="interruptor-pista" aria-hidden="true" />
      <span>
        <b>{usar ? 'Se usa en piezas' : 'No se usa en piezas'}</b>
        <span className="texto-chico"> {usar ? 'El motor de carruseles lo puede elegir.' : 'Gaseosas, golosinas comunes y todo lo que no va.'}</span>
      </span>
    </label>
  )
}
