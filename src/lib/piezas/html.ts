// Utilidades para armar el HTML de las placas.

export function escaparHtml(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Datos de contacto que van siempre visibles en las piezas (decisión del 15/11/2026)
export const CONTACTO = {
  web: 'tiendaonline.saboryaroma.com',
  whatsapp: 'WhatsApp 370 462-1563',
  instagram: '@saboryaroma__',
}

// Paleta de los carruseles aprobados (solo para las piezas, nunca para la interfaz)
export const PALETA = { verde: '#0b3b2e', verde2: '#137a52', oliva: '#6E9A35', naranja: '#ff8f00' }

export function respuestaHtml(html: string) {
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}
