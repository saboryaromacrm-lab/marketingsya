// Historia (1080×1920) a partir de una placa del carrusel (1080×1350): la placa queda en el medio,
// con una franja arriba (qué es) y otra abajo (cómo comprar). Puro: transforma el HTML de la placa.

import { escaparHtml as e } from '@/lib/piezas/html'
import type { EstiloCarrusel } from '@/lib/db/esquema'

const FONDO: Record<EstiloCarrusel, { fondo: string; titulo: string; color: string; pastilla: string }> = {
  nutriofertas: { fondo: 'background:#FFF1DC', titulo: 'NutriOfertas de la semana', color: '#ff8f00', pastilla: '#137a52' },
  recetas: { fondo: 'background:#EAF3E1', titulo: 'Receta de la semana', color: '#6E9A35', pastilla: '#6E9A35' },
  lanzamiento: { fondo: "background-color:#F6EFDF;background-image:url('/piezas/papel.svg')", titulo: 'Novedades en Sabor y Aroma', color: '#0b3b2e', pastilla: '#137a52' },
}

export function envolverHistoria(placa: string, estilo: EstiloCarrusel, contacto: { web: string; whatsapp: string; instagram: string }): string {
  const t = FONDO[estilo]
  const estilos = `<style>
body { height: 1920px !important; ${t.fondo}; }
.placa { margin-top: 285px; box-shadow: 0 0 0 0 transparent; }
.h-arriba { position: absolute; left: 0; right: 0; top: 0; height: 285px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
.h-arriba b { font-family: Fraunces, Georgia, serif; font-style: italic; font-weight: 800; font-size: 72px; color: ${t.color}; }
.h-arriba span { font: 800 30px Nunito, sans-serif; letter-spacing: 4px; text-transform: uppercase; color: #3e564c; }
.h-abajo { position: absolute; left: 0; right: 0; bottom: 0; height: 285px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; font-family: Nunito, sans-serif; }
.h-abajo .wa { padding: 20px 46px; border-radius: 999px; background: ${t.pastilla}; color: #fff; font-size: 44px; font-weight: 900; }
.h-abajo .web { font-size: 34px; font-weight: 800; color: #0b3b2e; }
</style>`
  const arriba = `<div class="h-arriba"><b>${e(t.titulo)}</b><span>${e(contacto.instagram)}</span></div>`
  const abajo = `<div class="h-abajo"><div class="wa">Pedí por WhatsApp ${e(contacto.whatsapp)}</div><div class="web">${e(contacto.web)} · sin mínimo de compra</div></div>`
  return placa
    .replace('<meta name="pieza-tamano" content="1080x1350">', '<meta name="pieza-tamano" content="1080x1920">')
    .replace('</head>', `${estilos}</head>`)
    .replace('<body>', `<body>${arriba}`)
    .replace('</body>', `${abajo}</body>`)
}
