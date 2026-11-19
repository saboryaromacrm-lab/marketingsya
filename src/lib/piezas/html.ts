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

/** Achica los textos que no entran y avisa al motor que la placa está lista (data-listo). */
export const AJUSTE = `<script>(async () => {
  await document.fonts.ready
  for (const el of document.querySelectorAll('[data-ajustar]')) {
    const lineas = Number(el.dataset.lineas || 1)
    const min = Number(el.dataset.ajustar)
    // Ancho: nada se sale de su caja. Alto: no más renglones de los permitidos
    // (se cuentan por el alto de renglón, no por el dibujo de la letra, que sobresale un poco).
    const entra = () => {
      const cs = getComputedStyle(el)
      const caja = el.parentElement
      return el.scrollWidth <= el.clientWidth + 1 && (lineas === 1 || el.offsetHeight <= lineas * parseFloat(cs.lineHeight) + 2) &&
        (!('caja' in el.dataset) || caja.scrollHeight <= caja.clientHeight + 1)
    }
    let f = parseFloat(getComputedStyle(el).fontSize)
    while (!entra() && f > min) { f -= 1; el.style.fontSize = f + 'px' }
    // Si ni con la letra mínima entra, se corta prolijo en los renglones permitidos
    if (!entra() && lineas > 1) { el.style.overflowWrap = 'anywhere'; el.style.maxHeight = (lineas * parseFloat(getComputedStyle(el).lineHeight)) + 'px'; el.style.overflow = 'hidden' }
  }
  document.documentElement.dataset.listo = '1'
})()</script>`

// data-ajustar="N": si el texto no entra, se achica de a 1 px hasta N px. Con data-lineas, hasta esa cantidad de renglones;
// con data-caja, tampoco se puede pasar de su caja. Se usa en el HTML de todas las placas.
export const ajustar = (min: number, lineas = 1, caja = false) => `data-ajustar="${min}"${lineas > 1 ? ` data-lineas="${lineas}"` : ''}${caja ? ' data-caja' : ''}`
