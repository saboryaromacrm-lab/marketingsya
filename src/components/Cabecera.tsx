import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icono } from './Icono'

// Miga de pan + título + subtítulo, con las acciones a la derecha del título.
export function Cabecera({ titulo, subtitulo, miga, acciones }: {
  titulo: ReactNode
  subtitulo?: string
  miga?: { texto: string; href?: string }[]
  acciones?: ReactNode
}) {
  const pasos = [{ texto: 'Inicio', href: '/' }, ...(miga ?? [])]
  return (
    <header className="cabecera">
      {miga && (
        <nav className="miga" aria-label="Ubicación">
          {pasos.map((p, i) => (
            <span key={i} className="miga-paso">
              {i > 0 && <Icono nombre="chevron_right" />}
              {p.href && i < pasos.length - 1 ? <Link href={p.href}>{p.texto}</Link> : <b>{p.texto}</b>}
            </span>
          ))}
        </nav>
      )}
      <div className="cabecera-fila">
        <div>
          <h1 className="titulo-pagina">{titulo}</h1>
          {subtitulo && <p className="texto-suave">{subtitulo}</p>}
        </div>
        {acciones && <div className="cabecera-acciones">{acciones}</div>}
      </div>
    </header>
  )
}
