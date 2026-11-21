'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Icono } from './Icono'
import { Logo } from './Logo'
import { MENU } from './navegacion'

const COOKIE_BARRA = 'sya_barra'

// Barra lateral + barra superior.
// En computadora la barra lateral se pliega y se recuerda (cookie).
// En el celular es un cajón que se abre con el mismo botón y se cierra al navegar.
export function Armazon({ plegadaInicial, contadores, avisos, logo, children }: {
  plegadaInicial: boolean
  logo?: string | null
  contadores?: Record<string, number>
  // Franjas a todo el ancho debajo de la barra superior (avance de la sincronización, alertas)
  avisos?: ReactNode
  children: ReactNode
}) {
  const ruta = usePathname()
  const router = useRouter()

  // Buscador de arriba: busca productos desde cualquier pantalla y lleva al catálogo
  function buscar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const campo = e.currentTarget.elements.namedItem('q') as HTMLInputElement
    const q = campo.value.trim()
    if (!q) return
    campo.value = ''
    campo.blur()
    router.push(`/catalogo?q=${encodeURIComponent(q)}`)
  }
  const [plegada, setPlegada] = useState(plegadaInicial)
  const [cajonAbierto, setCajonAbierto] = useState(false)

  useEffect(() => setCajonAbierto(false), [ruta])

  function alternar() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setCajonAbierto((a) => !a)
      return
    }
    const nueva = !plegada
    setPlegada(nueva)
    document.cookie = `${COOKIE_BARRA}=${nueva ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }

  const activo = (href: string) => (href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(href + '/'))

  return (
    <div className={`app ${plegada ? 'app-plegada' : ''} ${cajonAbierto ? 'app-cajon' : ''}`}>
      <aside className="barra" aria-label="Menú principal">
        <div className="barra-marca">
          <Logo src={logo} />
          <span>Plataforma de marketing</span>
        </div>
        {MENU.map((seccion) => (
          <div key={seccion.rotulo}>
            <div className="barra-rotulo">{seccion.rotulo}</div>
            <nav>
              {seccion.items.map((item) =>
                item.etapa ? (
                  <span key={item.href} className="barra-item barra-item-prox" title={`Llega en la etapa ${item.etapa}`}>
                    <Icono nombre={item.icono} />
                    {item.texto}
                    <small>ETAPA {item.etapa}</small>
                  </span>
                ) : (
                  <Link key={item.href} href={item.href} className={`barra-item ${activo(item.href) || item.rutas?.some(activo) ? 'barra-item-activo' : ''}`}>
                    <Icono nombre={item.icono} />
                    {item.texto}
                    {!!contadores?.[item.href] && <span className="contador">{contadores[item.href]}</span>}
                  </Link>
                ),
              )}
            </nav>
          </div>
        ))}
      </aside>
      <div className="velo" onClick={() => setCajonAbierto(false)} aria-hidden="true" />
      <div className="principal">
        <header className="superior">
          <button className="superior-boton" onClick={alternar} aria-label="Mostrar u ocultar el menú">
            <Icono nombre="menu_open" tamano={22} />
          </button>
          <form className="buscador-global" role="search" onSubmit={buscar}>
            <Icono nombre="search" />
            <input type="search" name="q" placeholder="Buscar productos..." aria-label="Buscar productos" enterKeyHint="search" />
          </form>
          <form action="/salir" method="post" className="superior-salir">
            <button className="btn btn-sec btn-chico" title="Cerrar sesión">
              <Icono nombre="logout" />
              <span className="ocultar-movil">Salir</span>
            </button>
          </form>
        </header>
        {avisos}
        {children}
      </div>
    </div>
  )
}
