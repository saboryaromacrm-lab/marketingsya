'use client'

import { useActionState } from 'react'
import { crearClave, type EstadoIngreso } from './acciones'
import { AYUDA_PIN, PIN_MAXIMO, PIN_MINIMO } from '@/lib/auth/pin'

export function FormularioCrearClave({ faltaCodigo }: { faltaCodigo: boolean }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(crearClave, {})
  if (faltaCodigo) {
    return (
      <p className="ingreso-error" role="alert">
        <span className="material-icons">error_outline</span>
        Falta configurar el código de instalación (CODIGO_INSTALACION) en Dokploy. Mirá la guía de instalación.
      </p>
    )
  }
  return (
    <form action={accion} className="ingreso-form">
      <p className="texto-suave">Es la primera vez: creá el PIN para entrar a la plataforma.</p>
      <label className="campo">
        <span className="campo-rotulo">Código de instalación</span>
        <input className="input" name="codigo" autoComplete="off" required autoFocus />
        <span className="texto-chico">El que escribiste en Dokploy como CODIGO_INSTALACION.</span>
      </label>
      <label className="campo">
        <span className="campo-rotulo">PIN nuevo</span>
        <input className="input input-pin" type="password" name="clave" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={PIN_MINIMO} maxLength={PIN_MAXIMO} required />
        <span className="texto-chico">{AYUDA_PIN}</span>
      </label>
      <label className="campo">
        <span className="campo-rotulo">Repetilo</span>
        <input className="input input-pin" type="password" name="repetir" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={PIN_MINIMO} maxLength={PIN_MAXIMO} required />
      </label>
      {estado.error && (
        <p className="ingreso-error" role="alert">
          <span className="material-icons">error_outline</span>
          {estado.error}
        </p>
      )}
      <button className="btn btn-pri btn-ancho" disabled={enviando}>{enviando ? 'Creando…' : 'Crear PIN y entrar'}</button>
    </form>
  )
}
