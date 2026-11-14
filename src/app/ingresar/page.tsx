import type { Metadata } from 'next'
import { FormularioIngreso } from './FormularioIngreso'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = { title: 'Ingresar' }

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver } = await searchParams
  return (
    <main className="ingreso">
      <div className="ingreso-tarjeta">
        <div className="ingreso-marca">
          <Logo tamano={56} />
          <div>
            <h1 className="ingreso-titulo">Plataforma de marketing</h1>
            <p className="texto-suave">Sabor y Aroma</p>
          </div>
        </div>
        <FormularioIngreso volver={volver ?? '/'} />
      </div>
    </main>
  )
}
