import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Nunito_Sans } from 'next/font/google'
import 'material-icons/iconfont/filled.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/armazon.css'
import '@/styles/componentes.css'

// La fuente se descarga al compilar y se sirve desde nuestro servidor.
const fuente = Nunito_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--fuente' })

export const metadata: Metadata = {
  title: { default: 'Plataforma de marketing', template: '%s · Sabor y Aroma' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#0c3b22', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={fuente.variable}>
      <body>{children}</body>
    </html>
  )
}
