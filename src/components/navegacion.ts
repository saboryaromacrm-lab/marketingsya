// Menú de la barra lateral. Lo que todavía no existe se ve en gris con su etapa.
// «rutas»: otras direcciones que también marcan el ítem como activo (Creación incluye carruseles y promos)
export type ItemMenu = { texto: string; href: string; icono: string; etapa?: number; rutas?: string[] }
export type SeccionMenu = { rotulo: string; items: ItemMenu[] }

export const MENU: SeccionMenu[] = [
  { rotulo: 'General', items: [{ texto: 'Inicio', href: '/', icono: 'dashboard' }] },
  {
    rotulo: 'Módulo',
    items: [
      { texto: 'Catálogo', href: '/catalogo', icono: 'inventory_2' },
      { texto: 'Creación', href: '/creacion', icono: 'palette', rutas: ['/carruseles', '/promos'] },
      { texto: 'Asesor IA', href: '/asesor', icono: 'auto_awesome' },
      { texto: 'Publicaciones', href: '/publicaciones', icono: 'send' },
      { texto: 'Pautas', href: '/pautas', icono: 'campaign' },
    ],
  },
  { rotulo: 'Sistema', items: [{ texto: 'Configuración', href: '/configuracion', icono: 'settings' }] },
]
