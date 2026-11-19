// Menú de la barra lateral. Lo que todavía no existe se ve en gris con su etapa.
export type ItemMenu = { texto: string; href: string; icono: string; etapa?: number }
export type SeccionMenu = { rotulo: string; items: ItemMenu[] }

export const MENU: SeccionMenu[] = [
  { rotulo: 'General', items: [{ texto: 'Inicio', href: '/', icono: 'dashboard' }] },
  {
    rotulo: 'Módulo',
    items: [
      { texto: 'Catálogo', href: '/catalogo', icono: 'inventory_2' },
      { texto: 'Carruseles', href: '/carruseles', icono: 'view_carousel' },
      { texto: 'Promos', href: '/promos', icono: 'sell' },
      { texto: 'Asesor IA', href: '/asesor', icono: 'auto_awesome' },
      { texto: 'Publicaciones', href: '/publicaciones', icono: 'send' },
      { texto: 'Pautas', href: '/pautas', icono: 'campaign', etapa: 6 },
    ],
  },
  { rotulo: 'Sistema', items: [{ texto: 'Configuración', href: '/configuracion', icono: 'settings' }] },
]
