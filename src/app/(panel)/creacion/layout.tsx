import type { ReactNode } from 'react'

// Creación: armar carruseles, historias, reels y promos desde el catálogo. Carruseles y Promos siguen en sus páginas.
export default function LayoutCreacion({ children }: { children: ReactNode }) {
  return (
    <div className="contenido">
      {children}
    </div>
  )
}
