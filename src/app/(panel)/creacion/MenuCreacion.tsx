import { Submenu } from '@/components/Submenu'

export function MenuCreacion() {
  return (
    <Submenu
      items={[
        { texto: 'Nueva pieza', href: '/creacion', icono: 'add_circle', exacto: true },
        { texto: 'Mis piezas', href: '/creacion/piezas', icono: 'collections' },
        { texto: 'Mis videos', href: '/creacion/videos', icono: 'video_library' },
        { texto: 'Carruseles', href: '/carruseles', icono: 'view_carousel' },
        { texto: 'Promos', href: '/promos', icono: 'sell' },
      ]}
    />
  )
}
