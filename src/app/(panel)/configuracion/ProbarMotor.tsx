'use client'

import { useEffect, useState, useTransition } from 'react'
import { Icono } from '@/components/Icono'
import { probarMotor } from './acciones-motor'

type Estado = { id: number; estado: string; avance: number; error: string | null; segundos: number | null; archivos: string[]; zip: string | null }

// Diagnóstico: arma 5 placas de prueba en JPEG con productos reales, para ver que el motor anda en el servidor.
export function ProbarMotor() {
  const [pendiente, empezar] = useTransition()
  const [id, setId] = useState<number | null>(null)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    const t = setInterval(async () => {
      const res = await fetch(`/api/exportaciones/${id}`, { cache: 'no-store' }).catch(() => null)
      if (!res?.ok || !vivo) return
      const s: Estado = await res.json()
      setEstado(s)
      if (s.estado === 'ok' || s.estado === 'error') clearInterval(t)
    }, 800)
    return () => { vivo = false; clearInterval(t) }
  }, [id])

  const corriendo = pendiente || (estado ? ['en_cola', 'corriendo'].includes(estado.estado) : !!id)
  return (
    <div className="probar-motor">
      <p className="texto-suave">Arma un carrusel de prueba de 5 placas con 3 productos al azar y lo pasa a JPEG, como se va a hacer con los carruseles de verdad. Sirve para comprobar que el motor anda en el servidor.</p>
      <div className="foto-acciones">
        <button className="btn btn-pri" disabled={corriendo} onClick={() => {
          setError(null); setEstado(null)
          empezar(async () => { const r = await probarMotor(); if ('error' in r) setError(r.error); else setId(r.id) })
        }}>
          <Icono nombre={corriendo ? 'sync' : 'play_arrow'} className={corriendo ? 'girando' : ''} />
          {corriendo ? `Armando… ${estado?.avance ?? 0}%` : 'Probar el motor de piezas'}
        </button>
        {estado?.estado === 'ok' && estado.zip && <a className="btn" href={estado.zip} download><Icono nombre="download" /> Descargar .zip</a>}
      </div>
      {error && <p className="texto-error" role="alert">{error}</p>}
      {estado?.estado === 'error' && <p className="texto-error" role="alert">El motor falló: {estado.error}</p>}
      {estado?.estado === 'ok' && (
        <>
          <p className="texto-ok" role="status">Anda: 5 placas en {estado.segundos} s.</p>
          <div className="miniaturas-placas">
            {estado.archivos.map((a, i) => <a key={a} href={a} target="_blank" rel="noreferrer"><img src={a} alt={`Placa ${i + 1}`} /></a>)}
          </div>
        </>
      )}
    </div>
  )
}
