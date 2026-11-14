import type { ReactNode } from 'react'

// Tarjeta de aviso: primero el dato (en negrita), después qué hacer.
// Verde para informar, ámbar cuando hay algo pendiente.
export function Aviso({ tono, dato, children, accion }: {
  tono: 'verde' | 'ambar'
  dato: string
  children?: ReactNode
  accion?: ReactNode
}) {
  return (
    <div className={`aviso aviso-${tono}`}>
      <div>
        <b>{dato}</b> {children && <span className="aviso-detalle">{children}</span>}
      </div>
      {accion && <div className="aviso-accion">{accion}</div>}
    </div>
  )
}

// Franja a todo el ancho debajo de la barra superior.
export function Franja({ tono, icono, dato, children }: {
  tono: 'rojo' | 'neutro'
  icono: string
  dato: string
  children?: ReactNode
}) {
  return (
    <div className={`franja franja-${tono}`}>
      <span aria-hidden="true">{icono}</span> <b>{dato}</b> {children}
    </div>
  )
}
