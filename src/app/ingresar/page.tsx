import type { Metadata } from 'next'
import { FormularioIngreso } from './FormularioIngreso'
import { FormularioCrearClave } from './FormularioCrearClave'
import { Logo } from '@/components/Logo'
import { leerAjuste } from '@/lib/ajustes'
import { hashDeClave } from '@/lib/auth/clave-guardada'
import { entorno } from '@/lib/entorno'
import { urlMedia } from '@/lib/media'

export const metadata: Metadata = { title: 'Ingresar' }
export const dynamic = 'force-dynamic'

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const [{ volver }, hash, logo] = await Promise.all([searchParams, hashDeClave(), leerAjuste('logo')])
  return (
    <main className="ingreso">
      <div className="ingreso-tarjeta">
        <div className="ingreso-marca">
          <Logo tamano={56} src={logo ? urlMedia(logo) : null} />
          <div>
            <h1 className="ingreso-titulo">Plataforma de marketing</h1>
            <p className="texto-suave">Sabor y Aroma</p>
          </div>
        </div>
        {hash ? <FormularioIngreso volver={volver ?? '/'} /> : <FormularioCrearClave faltaCodigo={!entorno.codigoInstalacion} />}
      </div>
    </main>
  )
}
