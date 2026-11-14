import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { Armazon } from '@/components/Armazon'
import { MonitorSincronizacion } from '@/components/sincronizacion/MonitorSincronizacion'
import { sincronizacionActiva } from '@/lib/catalogo/iniciar'
import { productosSinFoto } from '@/lib/catalogo/consultas'

export const dynamic = 'force-dynamic'

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const [galletas, activa, sinFoto] = await Promise.all([cookies(), sincronizacionActiva(), productosSinFoto()])
  const plegada = galletas.get('sya_barra')?.value === '1'
  return (
    <Armazon
      plegadaInicial={plegada}
      contadores={{ '/catalogo': sinFoto }}
      avisos={<MonitorSincronizacion inicial={activa && { id: activa.id, estado: activa.estado, etapa: activa.etapa, avance: activa.avance, resumen: activa.resumen, error: activa.error }} />}
    >
      {children}
    </Armazon>
  )
}
