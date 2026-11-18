'use client'

import { useActionState, useEffect, useRef } from 'react'
import { cambiarClave, type EstadoCambioClave } from './acciones'
import { AYUDA_PIN, PIN_MAXIMO, PIN_MINIMO } from '@/lib/auth/pin'

export function CambiarClave() {
  const [estado, accion, enviando] = useActionState<EstadoCambioClave, FormData>(cambiarClave, {})
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => { if (estado.ok) form.current?.reset() }, [estado])
  return (
    <form ref={form} action={accion} className="form-columnas">
      <label className="campo"><span className="campo-rotulo">PIN actual</span><input className="input input-pin" type="password" name="actual" inputMode="numeric" autoComplete="current-password" maxLength={64} required /></label>
      <label className="campo"><span className="campo-rotulo">PIN nuevo <span className="texto-chico">({AYUDA_PIN.toLowerCase().replace('.', '')})</span></span><input className="input input-pin" type="password" name="nueva" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={PIN_MINIMO} maxLength={PIN_MAXIMO} required /></label>
      <label className="campo"><span className="campo-rotulo">Repetí el PIN nuevo</span><input className="input input-pin" type="password" name="repetir" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={PIN_MINIMO} maxLength={PIN_MAXIMO} required /></label>
      <div className="form-pie">
        <button className="btn btn-pri" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar PIN'}</button>
        {estado.error && <span className="texto-error" role="alert">{estado.error}</span>}
        {estado.ok && <span className="texto-ok" role="status">Listo, el PIN cambió. Las sesiones abiertas siguen activas hasta que venzan.</span>}
      </div>
    </form>
  )
}
