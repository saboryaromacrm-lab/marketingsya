'use client'

import { useState, useTransition } from 'react'
import { Icono } from '@/components/Icono'
import { guardarNombrePiezas } from '@/app/(panel)/catalogo/acciones'

// Nombre que va en las piezas. Si queda vacío, se usa el sugerido.
export function NombrePiezas({ productoId, actual, sugerido }: { productoId: number; actual: string | null; sugerido: string }) {
  const [valor, setValor] = useState(actual ?? '')
  const [guardado, setGuardado] = useState(actual ?? '')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, empezar] = useTransition()

  const cambio = valor.trim() !== guardado
  function guardar(nuevo = valor) {
    setMensaje(null)
    empezar(async () => {
      const r = await guardarNombrePiezas(productoId, nuevo)
      if ('error' in r) return setMensaje({ ok: false, texto: r.error })
      setValor(r.nombre ?? '')
      setGuardado(r.nombre ?? '')
      setMensaje({ ok: true, texto: r.nombre ? 'Guardado.' : 'Guardado: se usa el sugerido.' })
    })
  }

  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor="nombre-piezas">Nombre para piezas</label>
      <form className="fila-campo" onSubmit={(e) => { e.preventDefault(); guardar() }}>
        <input id="nombre-piezas" className="input" value={valor} maxLength={120} placeholder={sugerido} onChange={(e) => { setValor(e.target.value); setMensaje(null) }} />
        <button className="btn btn-pri" disabled={!cambio || pendiente}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
      </form>
      <p className="texto-chico">
        {guardado ? <>Sugerido: «{sugerido}». <button type="button" className="enlace" onClick={() => guardar('')} disabled={pendiente}>Volver al sugerido</button></> : 'Vacío: en las piezas va el sugerido (el texto gris).'}
        {mensaje && <span className={mensaje.ok ? 'texto-ok' : 'texto-error'}> <Icono nombre={mensaje.ok ? 'check' : 'error'} tamano={14} /> {mensaje.texto}</span>}
      </p>
    </div>
  )
}
