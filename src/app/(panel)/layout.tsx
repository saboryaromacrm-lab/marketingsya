import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { Armazon } from '@/components/Armazon'

export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const plegada = (await cookies()).get('sya_barra')?.value === '1'
  return <Armazon plegadaInicial={plegada}>{children}</Armazon>
}
