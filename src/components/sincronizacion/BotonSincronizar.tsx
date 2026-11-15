'use client'

import { useEffect, useState, useTransition } from 'react'
import { Icono } from '@/components/Icono'
import { sincronizarAhora } from './acciones'
import { avisarInicio, FIN, INICIO } from './eventos'

export function BotonSincronizar({ activaInicial }: { activaInicial: boolean }) {
  const [activa, setActiva] = useState(activaInicial)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setActiva(true)
    const off = () => setActiva(false)
    window.addEventListener(INICIO, on)
    window.addEventListener(FIN, off)
    return () => {
      window.removeEventListener(INICIO, on)
      window.removeEventListener(FIN, off)
    }
  }, [])

  function clic() {
    setError(null)
    empezar(async () => {
      const r = await sincronizarAhora()
      if ('error' in r) setError(r.error)
      else avisarInicio(r.id)
    })
  }

  const ocupado = activa || pendiente
  return (
    <>
      <button className="btn btn-pri" onClick={clic} disabled={ocupado} title={error ?? undefined}>
        <Icono nombre="sync" className={ocupado ? 'girando' : ''} />
        {ocupado ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
      {error && <span className="texto-error">{error}</span>}
    </>
  )
}
