'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Icono } from '@/components/Icono'
import type { DisponibilidadIA } from '@/lib/ia/disponibilidad'
import { OBJETIVOS_PAUTA } from '@/lib/configuracion-tipos'
import type { SugerenciaPauta } from '@/lib/pautas/ia'
import { pesos } from '@/lib/pautas/reglas'
import { pedirSugerencia } from './acciones'

/** «¿Qué pauto?»: la IA propone un posteo, el objetivo y el monto. Solo sugiere; lanzar sigue pidiendo confirmación. */
export function SugerenciaIA({ ia }: { ia: DisponibilidadIA }) {
  const [s, setS] = useState<SugerenciaPauta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  return (
    <section className="tarjeta">
      <h2 className="titulo-seccion">¿Qué pauto?</h2>
      <p className="texto-suave">La IA mira cómo les fue a tus posteos (me gusta y comentarios), lo que dieron las pautas anteriores y lo que queda del tope del mes.</p>
      <button type="button" className="btn btn-chico boton-ia boton-izquierda" disabled={!ia.disponible || pendiente} title={ia.motivo ?? ''} onClick={() => empezar(async () => {
        setError(null)
        const r = await pedirSugerencia()
        if ('error' in r) setError(r.error)
        else setS(r.sugerencia)
      })}>
        <Icono nombre={pendiente ? 'sync' : 'auto_awesome'} tamano={16} className={pendiente ? 'girando' : ''} />
        {pendiente ? 'Pensando…' : 'Sugerir qué pautar'}
        {!pendiente && ia.disponible && <small className="costo-ia">{ia.costo}</small>}
      </button>
      {!ia.disponible && ia.motivo && <span className="texto-chico">{ia.motivo}</span>}
      {error && <span className="texto-error" role="alert">{error}</span>}
      {s && (
        <div className="sugerencia-pauta">
          <b>«{s.titulo}»</b>
          <span className="texto-chico">{OBJETIVOS_PAUTA[s.objetivo].nombre} · {pesos(s.porDia)} por día durante {s.dias} {s.dias === 1 ? 'día' : 'días'} (máximo {pesos(s.porDia * s.dias)})</span>
          <span>{s.motivo}</span>
          <Link prefetch={false} className="btn btn-pri btn-chico boton-izquierda" href={`/pautas/nueva?publicacion=${s.publicacionId}&objetivo=${s.objetivo}&porDia=${s.porDia}&dias=${s.dias}`}><Icono nombre="campaign" tamano={16} />Promocionar con esto</Link>
        </div>
      )}
    </section>
  )
}
