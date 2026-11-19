import type { ReactNode } from 'react'
import { Cabecera } from '@/components/Cabecera'
import { Submenu } from '@/components/Submenu'

export default function LayoutConfiguracion({ children }: { children: ReactNode }) {
  return (
    <div className="contenido">
      <Cabecera titulo="Configuración" subtitulo="Todo lo que se puede ajustar de la plataforma." miga={[{ texto: 'Configuración' }]} />
      <div className="dos-columnas">
        <Submenu
          items={[
            { texto: 'General', href: '/configuracion', icono: 'tune', exacto: true },
            { texto: 'Piezas', href: '/configuracion/piezas', icono: 'image' },
            { texto: 'Asesor IA', href: '/configuracion/asesor', icono: 'auto_awesome' },
            { texto: 'Seguridad', href: '/configuracion/seguridad', icono: 'lock' },
            { texto: 'Motor de piezas', href: '/configuracion/motor', icono: 'memory' },
          ]}
        />
        <div className="columna-principal">{children}</div>
      </div>
    </div>
  )
}
