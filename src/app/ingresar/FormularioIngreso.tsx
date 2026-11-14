'use client'

import { useActionState } from 'react'
import { ingresar, type EstadoIngreso } from './acciones'

export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(ingresar, {})
  return (
    <form action={accion} className="ingreso-form">
      <input type="hidden" name="volver" value={volver} />
      <label className="campo">
        <span className="campo-rotulo">Contraseña</span>
        <input className="input" type="password" name="clave" autoComplete="current-password" autoFocus required />
      </label>
      {estado.error && (
        <p className="ingreso-error" role="alert">
          <span className="material-icons">error_outline</span>
          {estado.error}
        </p>
      )}
      <button className="btn btn-pri btn-ancho" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
