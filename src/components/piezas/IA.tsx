'use client'

import { createContext, useContext, useState, useTransition } from 'react'
import { Icono } from '@/components/Icono'

export type { DisponibilidadIA } from '@/lib/ia/disponibilidad'
import type { DisponibilidadIA } from '@/lib/ia/disponibilidad'
export const ContextoIA = createContext<DisponibilidadIA>({ disponible: false, motivo: 'La IA no está conectada.', costo: '' })

type Respuesta = { ok: true; texto: string } | { error: string }

/** Botón de IA: pide un texto y lo entrega con `alObtener`. Muestra el costo aproximado y los errores. */
export function BotonIA({ texto, pedir, alObtener, chico = true }: { texto: string; pedir: () => Promise<Respuesta>; alObtener: (t: string) => void; chico?: boolean }) {
  const ia = useContext(ContextoIA)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="boton-ia-envoltura">
      <button
        type="button"
        className={`btn ${chico ? 'btn-chico' : ''} boton-ia`}
        disabled={!ia.disponible || pendiente}
        title={ia.motivo ?? `Cuesta ${ia.costo.replace('≈ ', 'aprox. ')}`}
        onClick={() => empezar(async () => {
          setError(null)
          const r = await pedir()
          if ('error' in r) setError(r.error)
          else alObtener(r.texto)
        })}
      >
        <Icono nombre={pendiente ? 'sync' : 'auto_awesome'} className={pendiente ? 'girando' : ''} tamano={16} />
        {pendiente ? 'Pensando…' : texto}
        {!pendiente && ia.disponible && ia.costo && <small className="costo-ia">{ia.costo}</small>}
      </button>
      {error && <span className="texto-error" role="alert">{error}</span>}
    </span>
  )
}
