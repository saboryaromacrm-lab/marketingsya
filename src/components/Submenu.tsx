'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icono } from './Icono'

// Tarjeta de submenú de la columna izquierda (ver «Dos columnas» en DISENO.md).
export function Submenu({ items }: { items: { texto: string; href: string; icono: string; exacto?: boolean }[] }) {
  const ruta = usePathname()
  return (
    <nav className="submenu" aria-label="Secciones">
      {items.map((i) => {
        const activo = i.exacto ? ruta === i.href : ruta === i.href || ruta.startsWith(i.href + '/')
        return (
          <Link key={i.href} href={i.href} className={activo ? 'submenu-activo' : ''}>
            <Icono nombre={i.icono} />
            {i.texto}
          </Link>
        )
      })}
    </nav>
  )
}
