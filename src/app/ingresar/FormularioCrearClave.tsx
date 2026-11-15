'use client'

import { useActionState } from 'react'
import { crearClave, type EstadoIngreso } from './acciones'

export function FormularioCrearClave({ largoMinimo, faltaCodigo }: { largoMinimo: number; faltaCodigo: boolean }) {
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
      <p className="texto-suave">Es la primera vez: creá la contraseña para entrar a la plataforma.</p>
      <label className="campo">
        <span className="campo-rotulo">Código de instalación</span>
        <input className="input" name="codigo" autoComplete="off" required autoFocus />
        <span className="texto-chico">El que escribiste en Dokploy como CODIGO_INSTALACION.</span>
      </label>
      <label className="campo">
        <span className="campo-rotulo">Contraseña nueva</span>
        <input className="input" type="password" name="clave" autoComplete="new-password" minLength={largoMinimo} required />
        <span className="texto-chico">Al menos {largoMinimo} caracteres.</span>
      </label>
      <label className="campo">
        <span className="campo-rotulo">Repetila</span>
        <input className="input" type="password" name="repetir" autoComplete="new-password" minLength={largoMinimo} required />
      </label>
      {estado.error && (
        <p className="ingreso-error" role="alert">
          <span className="material-icons">error_outline</span>
          {estado.error}
        </p>
      )}
      <button className="btn btn-pri btn-ancho" disabled={enviando}>{enviando ? 'Creando…' : 'Crear contraseña y entrar'}</button>
    </form>
  )
}
