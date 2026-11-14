import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icono } from '@/components/Icono'
import { Cabecera } from '@/components/Cabecera'
import { Submenu } from '@/components/Submenu'
import { BotonSincronizar } from '@/components/sincronizacion/BotonSincronizar'
import { sincronizacionActiva } from '@/lib/catalogo/iniciar'

export default async function LayoutCatalogo({ children }: { children: ReactNode }) {
  const activa = await sincronizacionActiva()
  return (
    <div className="contenido">
      <Cabecera
        titulo="Catálogo"
        subtitulo="Copia del catálogo del ERP para armar piezas. Se actualiza con el botón, no solo."
        miga={[{ texto: 'Catálogo' }]}
        acciones={
          <>
            <Link className="btn" href="/catalogo/fotos"><Icono nombre="add_photo_alternate" />Fotos en lote</Link>
            <BotonSincronizar activaInicial={!!activa} />
          </>
        }
      />
      <div className="dos-columnas">
        <Submenu
          items={[
            { texto: 'Productos', href: '/catalogo', icono: 'inventory_2', exacto: true },
            { texto: 'Marcas', href: '/catalogo/marcas', icono: 'sell' },
            { texto: 'Sincronizaciones', href: '/catalogo/sincronizaciones', icono: 'history' },
          ]}
        />
        <div className="columna-principal">{children}</div>
      </div>
    </div>
  )
}
