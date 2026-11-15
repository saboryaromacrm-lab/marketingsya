'use client'

import { useRouter } from 'next/navigation'
import { Icono } from './Icono'

// Vuelve a donde estaba (con los filtros puestos) si venía de la plataforma; si no, va al destino.
export function BotonVolver({ destino, texto }: { destino: string; texto: string }) {
  const router = useRouter()
  return (
    <a
      href={destino}
      className="volver"
      onClick={(e) => {
        if (document.referrer.startsWith(window.location.origin) && window.history.length > 1) {
          e.preventDefault()
          router.back()
        }
      }}
    >
      <Icono nombre="arrow_back" /> {texto}
    </a>
  )
}
