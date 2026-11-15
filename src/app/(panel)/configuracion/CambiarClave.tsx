'use client'

import { useActionState, useEffect, useRef } from 'react'
import { cambiarClave, type EstadoCambioClave } from './acciones'

export function CambiarClave({ largoMinimo }: { largoMinimo: number }) {
  const [estado, accion, enviando] = useActionState<EstadoCambioClave, FormData>(cambiarClave, {})
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => { if (estado.ok) form.current?.reset() }, [estado])
  return (
    <form ref={form} action={accion} className="form-columnas">
      <label className="campo"><span className="campo-rotulo">Contraseña actual</span><input className="input" type="password" name="actual" autoComplete="current-password" required /></label>
      <label className="campo"><span className="campo-rotulo">Nueva</span><input className="input" type="password" name="nueva" autoComplete="new-password" minLength={largoMinimo} required /></label>
      <label className="campo"><span className="campo-rotulo">Repetí la nueva</span><input className="input" type="password" name="repetir" autoComplete="new-password" minLength={largoMinimo} required /></label>
      <div className="form-pie">
        <button className="btn btn-pri" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button>
        {estado.error && <span className="texto-error" role="alert">{estado.error}</span>}
        {estado.ok && <span className="texto-ok" role="status">Listo, la contraseña cambió. Las sesiones abiertas siguen activas hasta que venzan.</span>}
      </div>
    </form>
  )
}
