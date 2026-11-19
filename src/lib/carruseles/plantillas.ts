// HTML de las placas de los 3 estilos de carrusel, pasados de los diseños aprobados (1080×1350).
// Paleta de los carruseles aprobados (nunca la del ERP). Fotos y precios del catálogo; textos del carrusel.
// Los recursos (papel, ramita, trazos de pincel, QR) están en /piezas y las fuentes en /fuentes.

import { AJUSTE, ajustar as aj, escaparHtml as e } from '@/lib/piezas/html'
import { partirWeb } from '@/lib/configuracion-tipos'
import type { EstiloCarrusel } from '@/lib/db/esquema'
import { etiquetaDeCategoria, fraseSugerida, lineaChica, nombreCorto, nombreEnPlaca, renglones, textoIngrediente } from './textos'
import type { DatosCarrusel, DatosLanzamiento, DatosNutriofertas, DatosRecetas, Id, PlacaCarrusel, ProductoNutri } from './tipos'

export type ProductoPieza = {
  id: number
  nombre: string
  marca: string | null
  foto: string | null
  granel: boolean
  categoria: string | null
  presentaciones: { tamano: string; kg: number | null }[]
  frase: string | null
}
export type PrecioPieza = { texto: string; unidad: string; antes: string | null } | null

export type ContextoPlaca = {
  estilo: EstiloCarrusel
  datos: DatosCarrusel
  placa: PlacaCarrusel
  indice: number // posición de la placa (0 = portada)
  productos: Map<number, ProductoPieza>
  semilla: number // para variar detalles solos (giros, hojitas), siempre igual para el mismo carrusel
  precio: (item: ProductoNutri) => PrecioPieza
  contacto: { web: string; whatsapp: string; instagram: string } // de Configuración › General
  qr: string // QR de la tienda (data URI), armado con la dirección de Configuración
}

const V = { oscuro: '#0b3b2e', verde: '#137a52', oliva: '#6E9A35', naranja: '#ff8f00', gris: '#3e564c' }
const FRAUNCES = 'font-family: Fraunces, Georgia, serif;'

// Números al azar pero repetibles: el mismo carrusel siempre sale igual
function azar(semilla: number) {
  let a = semilla >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cabeza = (fondo: string) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="pieza-tamano" content="1080x1350"><title>Placa</title><style>
@font-face { font-family: Fraunces; src: url('/fuentes/fraunces-latin.woff2') format('woff2'); font-weight: 100 900; font-style: normal; }
@font-face { font-family: Fraunces; src: url('/fuentes/fraunces-latin-italica.woff2') format('woff2'); font-weight: 100 900; font-style: italic; }
@font-face { font-family: Nunito; src: url('/fuentes/nunito-latin.woff2') format('woff2'); font-weight: 200 1000; font-style: normal; }
@font-face { font-family: Nunito; src: url('/fuentes/nunito-latin-italica.woff2') format('woff2'); font-weight: 200 1000; font-style: italic; }
* { box-sizing: border-box; } body { margin: 0; width: 1080px; height: 1350px; overflow: hidden; }
.placa { width: 1080px; height: 1350px; position: relative; overflow: hidden; font-family: Nunito, system-ui, sans-serif; color: ${V.oscuro}; ${fondo} }
.una { white-space: nowrap; overflow: hidden; }
.falta { display: grid; place-items: center; width: 100%; height: 100%; background: #eee; color: #999; font: 800 28px Nunito; text-align: center; }
</style></head><body>`
const pie = `${AJUSTE}</body></html>`

/** Título con renglones; el último renglón destacado (cursiva y color) si hay más de uno. */
function titulo(t: string, destacado: string | null, extra = ''): string {
  const r = renglones(t)
  return r.map((x, i) => (destacado && i === r.length - 1 && r.length > 1 ? `<span style="font-style: italic; font-weight: 800; color: ${destacado}; ${extra}">${e(x)}</span>` : e(x))).join('<br>')
}
const conCortes = (t: string) => renglones(t).map(e).join('<br>')

function foto(p: ProductoPieza | undefined, ancho: number, opciones: { zoom?: number; margen?: string } = {}) {
  if (!p?.foto) return `<div class="falta">${p ? 'Sin foto' : 'Elegí un producto'}</div>`
  // Sueltos (granel): la foto ampliada llena la forma. Envasados: entra completo, con margen.
  return p.granel
    ? `<img src="${e(p.foto)}" alt="" style="width: ${ancho}px; height: ${ancho}px; object-fit: cover; transform: scale(${opciones.zoom ?? 1.3}); display: block;">`
    : `<img src="${e(p.foto)}" alt="" style="width: ${ancho}px; height: ${ancho}px; object-fit: contain; padding: ${opciones.margen ?? '22px'}; box-sizing: border-box; display: block; background: #fff;">`
}
/** «tiendaonline.<resaltado>saboryaroma</resaltado>.com» con el color pedido. */
function webResaltada(web: string, color: string) {
  const [a, b, c] = partirWeb(web)
  return `${e(a)}<span style="color: ${color};">${e(b)}</span>${e(c)}`
}
const imgQR = (ctx: ContextoPlaca) => `<img src="${ctx.qr}" alt="Código QR a ${e(ctx.contacto.web)}" style="flex-shrink: 0; width: 270px; height: 270px; display: block;">`
const prod = (ctx: ContextoPlaca, id: Id) => (id != null ? ctx.productos.get(id) : undefined)
const logo = (estilo: string) => `<img src="/marca/circular-verde.svg" alt="Sabor y Aroma" style="position: absolute; ${estilo} object-fit: contain;">`

// ===========================================================================
// Estilo 1 · Lanzamiento (papel crema, acuarelas y ramita de olivo panorámica)
// ===========================================================================
const FORMAS = ['62% 38% 54% 46% / 48% 58% 42% 52%', '45% 55% 40% 60% / 58% 42% 58% 42%', '55% 45% 62% 38% / 42% 52% 48% 58%']
const SOMBRA = 'box-shadow: 0 16px 28px rgba(90,60,20,0.18);'

function lanzamiento(ctx: ContextoPlaca): string {
  const d = ctx.datos as DatosLanzamiento
  const r = azar(ctx.semilla)
  const deco = `<img src="/piezas/deco-lanzamiento.svg" alt="" aria-hidden="true" style="position: absolute; left: ${-1080 * Math.min(ctx.indice, 4)}px; top: 0; width: 5400px; height: 1350px; max-width: none;">`
  const h = (t: string, top: number, ancho: number, tam: number, alinear = 'left') =>
    `<h2 class="una" ${aj(56)} style="position: absolute; left: ${alinear === 'center' ? 60 : 80}px; top: ${top}px; margin: 0; width: ${ancho}px; text-align: ${alinear}; ${FRAUNCES} font-weight: 900; font-size: ${tam}px; line-height: 1.02; letter-spacing: -1.5px; color: ${V.oscuro};">${titulo(t, V.verde)}</h2>`
  let cuerpo = ''
  switch (ctx.placa.clave) {
    case 'portada': {
      const [a, b] = d.portada.productos.map((id) => prod(ctx, id))
      cuerpo = `${logo('left: 80px; top: 64px; width: 150px; height: 128px;')}
  <div style="position: absolute; left: 80px; top: 238px; display: flex; align-items: center; gap: 14px; transform: rotate(-3deg); transform-origin: left center;">
    <span class="una" style="${FRAUNCES} font-style: italic; font-weight: 800; font-size: 46px; color: ${V.naranja};">${e(d.portada.kicker)}</span>
    <svg aria-hidden="true" width="120" height="30" viewBox="0 0 120 30"><path d="M3 18 C 25 6, 45 26, 65 14 S 100 6, 117 16" fill="none" stroke="${V.naranja}" stroke-width="4" stroke-linecap="round"/></svg>
  </div>
  <h1 class="una" ${aj(60)} style="position: absolute; left: 80px; top: 300px; margin: 0; width: 920px; ${FRAUNCES} font-weight: 900; font-size: 112px; line-height: 0.98; letter-spacing: -2px; color: ${V.oscuro};">${titulo(d.portada.titulo, V.verde)}</h1>
  <div style="position: absolute; left: 80px; top: 660px;">
    <div class="una" ${aj(30)} style="display: flex; align-items: center; gap: 16px; max-width: 460px; padding: 20px 44px 20px 34px; border-radius: 999px; background: ${V.naranja}; color: #fff; box-shadow: 0 12px 26px rgba(90,55,10,0.25); font-size: 50px; font-weight: 900; line-height: 1;">
      <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex: none"><path d="M2 3h3l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6"/><circle cx="9.5" cy="20" r="1.4" fill="#fff"/><circle cx="17.5" cy="20" r="1.4" fill="#fff"/></svg>
      <span>${e(d.portada.pastilla)}</span>
    </div>
    <svg aria-hidden="true" width="50" height="60" viewBox="0 0 31 37" style="position: absolute; right: 6px; bottom: -34px;"><path d="M2 2 L2 28 L8.5 22.5 L13 33 L18 31 L13.5 20.5 L22 20.5 Z" fill="#fff" stroke="${V.oscuro}" stroke-width="2.2" stroke-linejoin="round"/></svg>
  </div>
  <div style="position: absolute; left: 555px; top: 625px; width: 440px; height: 440px;">
    <div style="position: absolute; inset: -16px; border: 3px solid ${V.oscuro}; border-radius: ${FORMAS[1]}; transform: rotate(${8 + r() * 6}deg);"></div>
    <div style="position: absolute; inset: 0; border-radius: ${FORMAS[0]}; overflow: hidden; background: #fff; box-shadow: 0 20px 34px rgba(90,60,20,0.20);">${foto(a, 440)}</div>
  </div>
  <div style="position: absolute; left: 150px; top: 860px; width: 290px; height: 290px;">
    <div style="position: absolute; inset: -12px; border: 3px dashed ${V.verde}; border-radius: ${FORMAS[2]}; transform: rotate(${-14 + r() * 6}deg);"></div>
    <div style="position: absolute; inset: 0; border-radius: ${FORMAS[1]}; overflow: hidden; background: #fff; ${SOMBRA}">${foto(b, 290)}</div>
  </div>
  <div style="position: absolute; left: 470px; top: 1105px; display: flex; align-items: center; gap: 10px; ${FRAUNCES} font-style: italic; font-weight: 600; font-size: 38px; color: ${V.oscuro};">
    <span class="una">${e(d.portada.pie)}</span>
    <svg aria-hidden="true" width="90" height="40" viewBox="0 0 90 40"><path d="M4 26 C 28 8, 54 34, 80 16" fill="none" stroke="${V.oscuro}" stroke-width="3.5" stroke-linecap="round"/><path d="M66 10 L82 15 L72 29" fill="none" stroke="${V.oscuro}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>`
      break
    }
    case 'productos': {
      const lugares = [
        { l: 70, t: 420, s: 300, el: 40 }, { l: 415, t: 380, s: 260, el: 50 }, { l: 725, t: 440, s: 285, el: 60 },
        { l: 110, t: 800, s: 270, el: 40 }, { l: 430, t: 720, s: 300, el: 70 }, { l: 775, t: 815, s: 245, el: 0 },
      ]
      const colores = [V.naranja, V.verde, V.oscuro, V.verde, V.naranja, V.oscuro]
      const items = d.productos.items.slice(0, 6).map((it, i) => {
        const p = prod(ctx, it.id)
        const g = lugares[i]
        const etiqueta = it.etiqueta || etiquetaDeCategoria(p?.categoria)
        return `<div style="position: absolute; left: ${g.l}px; top: ${g.t}px; width: ${g.s}px; height: ${g.s}px;">
    <div style="position: absolute; inset: 0; border-radius: ${FORMAS[(i + Math.floor(r() * 3)) % 3]}; overflow: hidden; background: #fff; ${SOMBRA}">${foto(p, g.s, { margen: '22px' })}</div>
    <div class="una" style="position: absolute; left: ${g.el}px; top: -20px; max-width: ${g.s + 30}px; padding: 8px 22px; background: ${colores[i]}; color: #fff; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: 32px; transform: rotate(${(r() * 12 - 6).toFixed(1)}deg); box-shadow: 0 4px 10px rgba(90,60,20,0.15);">${e(etiqueta)}</div>
  </div>`
      }).join('')
      cuerpo = `${h(d.productos.titulo, 80, 920, 96)}
  <p ${aj(24, 2)} style="position: absolute; left: 80px; top: 290px; margin: 0; width: 900px; font-size: 34px; font-weight: 700; line-height: 1.3; color: ${V.gris};">${e(d.productos.subtitulo)}</p>
  ${items}
  <p class="una" ${aj(24)} style="position: absolute; left: 80px; top: 1125px; margin: 0; width: 920px; text-align: center; ${FRAUNCES} font-style: italic; font-weight: 600; font-size: 36px; color: ${V.oscuro};">${e(d.productos.pie)}</p>`
      break
    }
    case 'comoComprar': {
      const colores = [V.naranja, V.verde, V.oscuro]
      cuerpo = `<div style="position: absolute; left: 780px; top: 70px; width: 230px; height: 230px;">
    <div style="position: absolute; inset: -12px; border: 3px dashed ${V.naranja}; border-radius: ${FORMAS[2]}; transform: rotate(14deg);"></div>
    <div style="position: absolute; inset: 0; border-radius: ${FORMAS[0]}; overflow: hidden; background: #fff; ${SOMBRA}">${foto(prod(ctx, d.comoComprar.foto), 230, { margen: '18px' })}</div>
  </div>
  <h2 class="una" ${aj(56)} style="position: absolute; left: 80px; top: 80px; margin: 0; width: 680px; ${FRAUNCES} font-weight: 900; font-size: 96px; line-height: 0.98; letter-spacing: -1.5px; color: ${V.oscuro};">${titulo(d.comoComprar.titulo, V.verde)}</h2>
  <svg aria-hidden="true" width="40" height="470" viewBox="0 0 40 470" style="position: absolute; left: 135px; top: 470px;"><path d="M20 0 C 2 80, 38 160, 20 235 S 2 400, 20 470" fill="none" stroke="${V.oscuro}" stroke-width="3.5" stroke-dasharray="2 14" stroke-linecap="round"/></svg>
  <div style="position: absolute; left: 80px; top: 360px; width: 920px; display: flex; flex-direction: column; gap: 70px;">
    ${d.comoComprar.pasos.slice(0, 3).map((p, i) => `<div style="display: flex; align-items: center; gap: 36px;">
      <div style="flex-shrink: 0; width: 150px; height: 150px; border-radius: ${FORMAS[i]}; background: ${colores[i]}; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(90,60,20,0.18); ${FRAUNCES} font-weight: 900; font-size: 84px; color: #fff;">${i + 1}</div>
      <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0; width: 734px;">
        <div class="una" ${aj(32)} style="${FRAUNCES} font-weight: 800; font-size: 50px; line-height: 1.1; color: ${V.oscuro};">${e(p.titulo)}</div>
        <div ${aj(22, 2)} style="font-size: 33px; font-weight: 700; line-height: 1.3; color: ${V.gris};">${e(p.texto)}</div>
      </div>
    </div>`).join('')}
  </div>`
      break
    }
    case 'porQue': {
      const sellos = [
        { l: 70, t: 360, c: V.oscuro, g: -8 }, { l: 395, t: 420, c: V.naranja, g: 6 }, { l: 720, t: 360, c: V.verde, g: -5 },
      ]
      const iconos = [
        '<path d="M20 4c-9 0-15 5-15 12 0 1.5.4 2.8 1 4 1-5 4-8 9-10-4 3-6.5 6-7.5 10C17 19 20 13 20 4z"/>',
        '<path d="M1 5h13v10H1z"/><path d="M14 9h4l4 4v2h-8z"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="18" cy="17.5" r="2"/>',
      ]
      cuerpo = `${h(d.porQue.titulo, 80, 920, 96)}
  ${d.porQue.sellos.slice(0, 3).map((t, i) => `<div style="position: absolute; left: ${sellos[i].l}px; top: ${sellos[i].t}px; width: 290px; height: 290px; border-radius: 52% 48% 50% 50% / 49% 52% 48% 51%; background: ${sellos[i].c}; display: flex; align-items: center; justify-content: center; transform: rotate(${sellos[i].g}deg); box-shadow: 0 12px 24px rgba(90,60,20,0.20);">
    <div style="width: 248px; height: 248px; border-radius: 50%; border: 3px dashed rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px;"><div ${aj(26, 3)} style="max-width: 100%; ${FRAUNCES} font-weight: 900; font-size: ${renglones(t).some((x) => x.length > 9) ? 40 : 50}px; line-height: 1.04; color: #fff;">${conCortes(t)}</div></div>
  </div>`).join('')}
  <div style="position: absolute; left: 80px; top: 790px; width: 920px; padding: 38px 44px; border-radius: 42px 56px 38px 60px / 50px 40px 58px 44px; background: #FFFBF2; border: 3px dashed #c9b48e; display: flex; flex-direction: column; gap: 30px;">
    ${d.porQue.items.slice(0, 2).map((it, i) => `<div style="display: flex; align-items: center; gap: 26px;">
      <div style="flex-shrink: 0; width: 92px; height: 92px; border-radius: ${FORMAS[2 - i]}; background: ${i ? V.naranja : V.verde}; display: flex; align-items: center; justify-content: center;">
        <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconos[i]}</svg>
      </div>
      <div ${aj(22, 3)} style="font-size: 34px; font-weight: 700; line-height: 1.3; color: ${V.gris};"><span style="${FRAUNCES} font-weight: 800; color: ${V.oscuro};">${e(it.titulo)}</span> ${e(it.texto)}</div>
    </div>`).join('')}
  </div>`
      break
    }
    default: {
      cuerpo = `${logo('left: 465px; top: 60px; width: 150px; height: 128px;')}
  ${h(d.cierre.titulo, 220, 960, 82, 'center')}
  <div style="position: absolute; left: 90px; top: 450px; width: 900px; padding: 34px 40px; border-radius: 48px 62px 44px 66px / 58px 46px 64px 50px; background: #fff; box-shadow: 0 18px 36px rgba(90,60,20,0.18); display: flex; align-items: center; gap: 40px;">
    ${imgQR(ctx)}
    <div style="display: flex; flex-direction: column; gap: 18px;">
      <div style="${FRAUNCES} font-weight: 800; font-size: 50px; line-height: 1.02; color: ${V.oscuro};">Escaneá<br>y comprá</div>
      <div style="font-size: 31px; font-weight: 700; line-height: 1.3; color: ${V.gris};">desde tu celular, cuando quieras.</div>
      <div style="align-self: flex-start; display: flex; align-items: center; gap: 12px; padding: 16px 34px; border-radius: 999px; background: ${V.verde}; color: #fff; font-size: 34px; font-weight: 900;">Ir a la tienda <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></div>
    </div>
  </div>
  <div style="position: absolute; left: 60px; top: 880px; width: 960px; padding: 28px 24px; border-radius: 40px 56px 36px 60px / 52px 38px 58px 42px; background: ${V.oscuro}; transform: rotate(-1.5deg); box-shadow: 0 14px 28px rgba(11,59,46,0.28); text-align: center;">
    <div style="font-size: 30px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: #ffd08a;">Entrá a</div>
    <div style="margin-top: 6px; font-size: 58px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.1; color: #fff;">${webResaltada(ctx.contacto.web, V.naranja)}</div>
  </div>
  <p class="una" ${aj(24)} style="position: absolute; left: 60px; top: 1100px; margin: 0; width: 960px; text-align: center; ${FRAUNCES} font-style: italic; font-weight: 600; font-size: 36px; color: ${V.oscuro};">${e(d.cierre.pie)}</p>`
    }
  }
  return `${cabeza("background-color: #F6EFDF; background-image: url('/piezas/papel.svg');")}<div class="placa">${deco}${cuerpo}</div>${pie}`
}

// ===========================================================================
// Estilos 2 y 3 · ondas (durazno para NutriOfertas, lima para Recetas)
// ===========================================================================
type Paleta = { fondo1: string; fondo2: string; hojas: string; tallo: string; puntos: string; arcos: string; pastilla: string; pincel: string }
const DURAZNO: Paleta = { fondo1: '#FFD7A3', fondo2: '#FFE9CC', hojas: V.verde, tallo: V.verde, puntos: V.naranja, arcos: V.verde, pastilla: V.verde, pincel: '/piezas/pincel-verde.svg' }
const LIMA: Paleta = { fondo1: '#CDE3BC', fondo2: '#E2EFD6', hojas: V.oliva, tallo: V.oliva, puntos: V.verde, arcos: V.verde, pastilla: V.oliva, pincel: '/piezas/pincel-lima.svg' }

const HOJAS_A = (c: string, t: string) => `<path d="M600 0 C 595 40, 585 80, 570 120" fill="none" stroke="${t}" stroke-width="4"/><ellipse cx="588" cy="30" rx="20" ry="8" transform="rotate(-40 588 30)"/><ellipse cx="606" cy="52" rx="20" ry="8" transform="rotate(30 606 52)"/><ellipse cx="572" cy="80" rx="20" ry="8" transform="rotate(-50 572 80)"/><ellipse cx="594" cy="98" rx="20" ry="8" transform="rotate(40 594 98)"/>`
const HOJAS_B = (c: string, t: string) => `<path d="M700 0 C 715 30, 745 55, 785 70" fill="none" stroke="${t}" stroke-width="4"/><ellipse cx="716" cy="22" rx="20" ry="8" transform="rotate(60 716 22)"/><ellipse cx="742" cy="40" rx="20" ry="8" transform="rotate(-20 742 40)"/><ellipse cx="770" cy="70" rx="20" ry="8" transform="rotate(30 770 70)"/>`

function ondas(p: Paleta, espejo: boolean, hojas: 'ab' | 'a' | 'b', puntosY = 0): string {
  const h = hojas === 'ab' ? HOJAS_A(p.hojas, p.tallo) + HOJAS_B(p.hojas, p.tallo) : hojas === 'a' ? HOJAS_A(p.hojas, p.tallo) : HOJAS_B(p.hojas, p.tallo)
  return `<svg aria-hidden="true" width="1080" height="1350" viewBox="0 0 1080 1350" style="position: absolute; left: 0; top: 0;${espejo ? ' transform: scaleX(-1);' : ''}">
    <path d="M0 0 H 660 C 580 100, 640 220, 560 320 C 470 430, 330 420, 330 560 C 330 690, 470 760, 420 900 C 380 1000, 200 1040, 0 1060 Z" fill="${p.fondo1}"/>
    <path d="M0 0 H 420 C 380 80, 420 170, 350 250 C 280 330, 150 320, 120 430 C 95 520, 160 600, 110 690 C 80 740, 30 760, 0 770 Z" fill="${p.fondo2}"/>
    <path d="M640 0 C 560 90, 600 200, 520 300 C 430 410, 260 380, 230 520" fill="none" stroke="#FFFDF7" stroke-width="22" stroke-linecap="round"/>
    <g fill="${p.hojas}" opacity="0.5">${h}</g>
    <g fill="${p.puntos}" opacity="0.75" transform="translate(0 ${puntosY})"><path d="M880 1040 q 12 -14 22 0 q -10 14 -22 0z"/><path d="M930 1080 q 10 -12 18 0 q -8 12 -18 0z"/><path d="M870 1110 q 9 -10 16 0 q -7 10 -16 0z"/><path d="M960 1020 q 8 -10 14 0 q -6 10 -14 0z"/><path d="M915 1140 q 11 -12 20 0 q -9 12 -20 0z"/></g>
    <g fill="none" stroke="${p.arcos}" stroke-width="7" opacity="0.5"><path d="M830 1350 A 140 140 0 0 1 1110 1350"/><path d="M875 1350 A 95 95 0 0 1 1065 1350"/><path d="M920 1350 A 50 50 0 0 1 1020 1350"/></g>
  </svg>`
}

const pastillaWeb = (p: Paleta, ctx: ContextoPlaca) => `<div style="position: absolute; left: 44px; top: 46px; padding: 10px 24px; border-radius: 999px; background: ${p.pastilla}; color: #fff; font-size: 24px; font-weight: 800;">${e(ctx.contacto.web)}</div>${logo('right: 70px; top: 60px; width: 130px; height: 111px;')}`

/** Plato redondo con la foto y el trazo de pincel que lo abraza. A la izquierda (grande) o a la derecha. */
function plato(p: Paleta, producto: ProductoPieza | undefined, derecha: boolean): string {
  const caja = derecha
    ? 'left: 510px; top: 750px; width: 680px; height: 680px;'
    : 'left: -170px; top: 720px; width: 800px; height: 800px;'
  const ancho = derecha ? 640 : 760
  const f = foto(producto, ancho, { zoom: 1.16, margen: derecha ? '50px 120px 110px 40px' : '60px 40px 150px 190px' })
  return `<div style="position: absolute; ${caja} border-radius: 50%; overflow: hidden; background: #fff; border: 20px solid #fff; box-shadow: 0 30px 60px rgba(40,60,30,0.28);">${f}</div>
  <img src="${p.pincel}" alt="" aria-hidden="true" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1350px;${derecha ? ' transform: scaleX(-1);' : ''}">`
}

const HOJITAS_ARRIBA = '<svg aria-hidden="true" width="60" height="26" viewBox="0 0 60 26"><g fill="#fff"><ellipse cx="18" cy="14" rx="14" ry="6" transform="rotate(-25 18 14)"/><ellipse cx="42" cy="14" rx="14" ry="6" transform="rotate(25 42 14)"/></g></svg>'
const HOJITAS_ABAJO = '<svg aria-hidden="true" width="60" height="26" viewBox="0 0 60 26"><g fill="#fff"><ellipse cx="18" cy="12" rx="14" ry="6" transform="rotate(25 18 12)"/><ellipse cx="42" cy="12" rx="14" ry="6" transform="rotate(-25 42 12)"/></g></svg>'

function sello(texto: string, color: string, lugar: string, giro: number, tam = 230, hojitas = true): string {
  const interior = tam - 34
  const largo = renglones(texto).length
  const fuente = tam >= 230 ? (largo > 1 ? 40 : 48) : largo > 2 ? 30 : largo > 1 ? 32 : 42
  return `<div style="position: absolute; ${lugar} width: ${tam}px; height: ${tam}px; border-radius: 50%; background: ${color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 ${tam >= 230 ? 12 : 10}px rgba(255,255,255,0.7); transform: rotate(${giro}deg);">
    <div style="width: ${interior}px; height: ${interior}px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; text-align: center; padding: 14px;">
      ${hojitas ? HOJITAS_ARRIBA : ''}<div ${aj(22, 3)} style="${FRAUNCES} font-style: italic; font-weight: 800; font-size: ${fuente}px; line-height: 1.04; max-width: 100%;">${conCortes(texto)}</div>${hojitas ? HOJITAS_ABAJO : ''}
    </div>
  </div>`
}

const bajada = (t: string, extra = '') => `<div class="una" ${aj(18)} style="margin-top: 14px; font-size: 30px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: ${V.gris}; ${extra}">${e(t)}</div>`

function portadaOndas(ctx: ContextoPlaca, p: Paleta, d: { titulo: string; bajada: string; destacado: string; texto: string; boton: string; sello: string; producto: Id }, colorTitulo: string, colorBoton: string, colorSello: string, tamTitulo: number, r: () => number): string {
  return `${ondas(p, false, 'ab')}${pastillaWeb(p, ctx)}${plato(p, prod(ctx, d.producto), false)}
  ${sello(d.sello, colorSello, 'left: 60px; top: 470px;', Math.round(r() * 10 - 5))}
  <div style="position: absolute; left: 470px; top: 200px; width: 550px; text-align: right;">
    <h1 class="una" ${aj(60)} style="margin: 0; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: ${tamTitulo}px; line-height: 1.02; color: ${colorTitulo};">${conCortes(d.titulo)}</h1>
    ${bajada(d.bajada, 'margin-top: 14px; font-size: 32px;')}
  </div>
  <div style="position: absolute; left: 700px; top: 520px; width: 320px; text-align: right;">
    <div class="una" ${aj(20)} style="font-size: 34px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: ${V.oscuro};">${e(d.destacado)}</div>
    <div ${aj(18, 3)} style="margin-top: 10px; font-size: 28px; font-weight: 600; line-height: 1.4; color: ${V.gris};">${e(d.texto)}</div>
    <div class="una" style="margin-top: 22px; display: inline-block; max-width: 320px; padding: 14px 30px; border-radius: 999px; background: ${colorBoton}; color: #fff; font-size: 30px; font-weight: 900;">${e(d.boton)}</div>
  </div>`
}

function cierreOndas(ctx: ContextoPlaca, p: Paleta, d: { titulo: string; bajada: string }, colorDestacado: string, boton: string, colorBoton: string, fondoWeb: string, colorSello: string, r: () => number): string {
  return `${ondas(p, false, 'b', 130)}${pastillaWeb(p, ctx)}
  <div style="position: absolute; left: 70px; top: 200px; width: 720px;">
    <h2 class="una" ${aj(56)} style="margin: 0; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: 100px; line-height: 1.02; color: ${V.oscuro};">${titulo(d.titulo, colorDestacado)}</h2>
    ${bajada(d.bajada, 'margin-top: 16px;')}
  </div>
  ${sello('Sin / mínimo de / compra', colorSello, 'left: 820px; top: 230px;', Math.round(4 + r() * 6), 200, false)}
  <div style="position: absolute; left: 90px; top: 560px; width: 900px; padding: 34px 40px; border-radius: 56px; background: #fff; box-shadow: 0 20px 40px rgba(90,60,20,0.16); display: flex; align-items: center; gap: 40px;">
    ${imgQR(ctx)}
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="${FRAUNCES} font-style: italic; font-weight: 800; font-size: 54px; line-height: 1.0; color: ${V.oscuro};">Escaneá<br>y comprá</div>
      <div style="font-size: 30px; font-weight: 600; line-height: 1.35; color: ${V.gris};">Pedís online y lo retirás o te lo llevamos.</div>
      <div style="align-self: flex-start; padding: 16px 34px; border-radius: 999px; background: ${colorBoton}; color: #fff; font-size: 32px; font-weight: 900;">${e(boton)}</div>
    </div>
  </div>
  <div style="position: absolute; left: 90px; top: 1000px; width: 900px; padding: 26px 20px; border-radius: 999px; background: ${fondoWeb}; text-align: center; color: #fff; font-size: 54px; font-weight: 900; letter-spacing: -0.5px;">${webResaltada(ctx.contacto.web, '#ffd08a')}</div>
  <div style="position: absolute; left: 90px; top: 1135px; width: 900px; text-align: center; font-size: 30px; font-weight: 700; color: ${V.gris};">Envíos a todo Formosa Capital</div>`
}

// ---------------------------------------------------------------------------
// Estilo 2 · NutriOfertas
// ---------------------------------------------------------------------------
function nutriofertas(ctx: ContextoPlaca): string {
  const d = ctx.datos as DatosNutriofertas
  const r = azar(ctx.semilla + ctx.indice * 31)
  let cuerpo: string
  if (ctx.placa.clave === 'portada') {
    cuerpo = portadaOndas(ctx, DURAZNO, d.portada, V.naranja, V.naranja, V.verde, 124, r)
  } else if (ctx.placa.clave === 'cierre') {
    cuerpo = cierreOndas(ctx, DURAZNO, d.cierre, V.naranja, 'Ver las NutriOfertas →', V.naranja, V.verde, V.verde, r)
  } else {
    const k = Number(ctx.placa.clave.split('-')[1])
    const it = d.productos[k]
    const p = prod(ctx, it.id)
    // Los platos se alternan solos: el primer producto a la derecha (como el diseño), salvo que se pida lo contrario
    const derecha = (k % 2 === 0) !== (d.variante === 'derecha')
    const nombre = it.nombre || (p ? nombreEnPlaca(p) : 'Producto')
    const linea = it.linea ?? (p ? lineaChica(p) : '')
    const frase = it.frase || p?.frase || fraseSugerida(p?.categoria)
    const precio = ctx.precio(it)
    const alinear = derecha ? 'left' : 'right'
    const columna = derecha ? 'left: 70px; width: 640px; align-items: flex-start;' : 'left: 420px; width: 600px; align-items: flex-end;'
    cuerpo = `${ondas(DURAZNO, derecha, r() < 0.5 ? 'a' : 'b', Math.round(r() * 60))}${pastillaWeb(DURAZNO, ctx)}${plato(DURAZNO, p, derecha)}
  ${sello('Oferta', V.naranja, derecha ? 'left: 790px; top: 470px;' : 'left: 60px; top: 470px;', Math.round((r() * 8 + 4) * (r() < 0.5 ? -1 : 1)))}
  <div style="position: absolute; top: 190px; ${columna} display: flex; flex-direction: column; text-align: ${alinear};">
    <div style="${FRAUNCES} font-style: italic; font-weight: 800; font-size: 44px; color: ${V.naranja};">NutriOferta</div>
    <h2 class="una" ${aj(56)} style="margin: 6px 0 0; max-width: 100%; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: ${renglones(nombre).length > 2 ? 86 : 104}px; line-height: 1; color: ${V.oscuro};">${conCortes(nombre)}</h2>
    ${linea ? bajada(linea, 'margin-top: 16px; max-width: 100%;') : ''}
    <div style="margin-top: 40px; display: flex; flex-direction: column; gap: 8px; align-items: ${derecha ? 'flex-start' : 'flex-end'};">
      ${precio?.antes ? `<span style="font-size: 30px; font-weight: 800; color: ${V.gris};">antes <s style="text-decoration-thickness: 3px;">${e(precio.antes)}</s></span>` : ''}
      <span style="font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: ${V.naranja};">Precio NutriOferta</span>
      <span class="una" ${aj(30)} style="max-width: 460px; padding: 10px 30px; border-radius: 999px; background: ${V.oscuro}; color: #fff; font-size: 48px; font-weight: 900;">${precio ? `${e(precio.texto)}${precio.unidad && precio.unidad !== 'c/u' ? ` <small style="font-size: 28px; font-weight: 800;">${e(precio.unidad)}</small>` : ''}` : 'Consultá'}</span>
    </div>
    <div ${aj(20, 4)} style="margin-top: 26px; width: 320px; font-size: 29px; font-weight: 600; line-height: 1.4; color: ${V.gris};">${e(frase)}</div>
  </div>`
  }
  return `${cabeza('background: #FFFDF7;')}<div class="placa">${cuerpo}</div>${pie}`
}

// ---------------------------------------------------------------------------
// Estilo 3 · Recetas
// ---------------------------------------------------------------------------
function recetas(ctx: ContextoPlaca): string {
  const d = ctx.datos as DatosRecetas
  const r = azar(ctx.semilla + ctx.indice * 17)
  let cuerpo: string
  const anillo = (p: ProductoPieza | undefined, tam: number, anchoAnillo = 9) =>
    `<div style="flex-shrink: 0; width: ${tam}px; height: ${tam}px; border-radius: 50%; overflow: hidden; background: #fff; box-shadow: 0 0 0 ${anchoAnillo - 3}px #fff, 0 0 0 ${anchoAnillo}px ${V.oliva}, 0 12px 24px rgba(40,70,40,0.18);">${foto(p, tam, { zoom: 1.25, margen: '14px' })}</div>`
  switch (ctx.placa.clave) {
    case 'portada':
      cuerpo = portadaOndas(ctx, LIMA, d.portada, V.verde, V.verde, V.oliva, 112, r)
      break
    case 'ingredientes': {
      const items = d.ingredientes.items.slice(0, 5)
      cuerpo = `${ondas(LIMA, false, 'a', -2000)}${pastillaWeb(LIMA, ctx)}
  <div style="position: absolute; left: 70px; top: 180px; width: 700px;">
    <h2 class="una" ${aj(56)} style="margin: 0; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: 108px; line-height: 1; color: ${V.verde};">${conCortes(d.ingredientes.titulo)}</h2>
    ${bajada(d.ingredientes.bajada)}
  </div>
  <div style="position: absolute; left: 70px; top: 400px; width: 720px; display: flex; flex-direction: column; gap: ${items.length > 4 ? 22 : 34}px;">
    ${items.map((it) => {
      const p = prod(ctx, it.id)
      return `<div style="display: flex; align-items: center; gap: 30px;">${anillo(p, 150)}
      <div style="min-width: 0; width: 540px;"><div class="una" ${aj(26)} style="${FRAUNCES} font-style: italic; font-weight: 800; font-size: 44px; color: ${V.verde};">${e(it.cantidad || ' ')}</div><div ${aj(20, 2)} style="font-size: 32px; font-weight: 700; color: ${V.oscuro}; line-height: 1.2;">${e(it.texto || (p ? textoIngrediente(p) : ''))}</div></div>
    </div>`
    }).join('')}
  </div>
  ${sello(d.ingredientes.sello, V.oliva, 'left: 800px; top: 560px;', Math.round(4 + r() * 6), 210, false)}`
      break
    }
    case 'preparacion': {
      const pasos = d.preparacion.pasos.filter((x) => x.trim()).length ? d.preparacion.pasos : ['Escribí el primer paso', 'Escribí el segundo paso']
      const colores = [V.oliva, V.verde, V.naranja, V.oscuro]
      cuerpo = `${ondas(LIMA, false, 'b', 0)}${pastillaWeb(LIMA, ctx)}${plato(LIMA, prod(ctx, d.preparacion.foto), false)}
  <div style="position: absolute; left: 420px; top: 190px; width: 600px; text-align: right;">
    <h2 class="una" ${aj(56)} style="margin: 0; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: 108px; line-height: 1; color: ${V.verde};">${conCortes(d.preparacion.titulo)}</h2>
    ${bajada(`En ${pasos.length} pasos`)}
  </div>
  <div style="position: absolute; left: 660px; top: 360px; width: 360px; height: ${pasos.length > 3 ? 680 : 560}px; display: flex; flex-direction: column; gap: 22px;">
    ${pasos.map((t, i) => `<div style="display: flex; align-items: flex-start; gap: 18px;">
      <div style="flex-shrink: 0; width: 70px; height: 70px; border-radius: 50%; background: ${colores[i % 4]}; color: #fff; display: flex; align-items: center; justify-content: center; ${FRAUNCES} font-weight: 900; font-size: 40px;">${i + 1}</div>
      <div ${aj(20, pasos.length > 3 ? 4 : 5)} style="font-size: 28px; font-weight: 700; line-height: 1.35; color: ${V.oscuro};">${e(t)}</div>
    </div>`).join('')}
  </div>`
      break
    }
    case 'porQue': {
      const items = d.porQue.items.slice(0, 4)
      cuerpo = `${ondas(LIMA, false, 'a', 180)}${pastillaWeb(LIMA, ctx)}
  <div style="position: absolute; left: 70px; top: 180px; width: 720px;">
    <h2 class="una" ${aj(56)} style="margin: 0; ${FRAUNCES} font-style: italic; font-weight: 800; font-size: 100px; line-height: 1; color: ${V.verde};">${conCortes(d.porQue.titulo)}</h2>
  </div>
  ${sello(d.porQue.sello, V.oliva, 'left: 810px; top: 230px;', Math.round(-3 - r() * 6), 200, false)}
  <div style="position: absolute; left: 70px; top: 470px; width: 940px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px;">
    ${items.map((it) => {
      const p = prod(ctx, it.id)
      return `<div style="padding: 30px; border-radius: 44px; background: #fff; box-shadow: 0 16px 32px rgba(40,70,40,0.12); display: flex; flex-direction: column; gap: 14px; height: ${items.length > 2 ? 360 : 420}px; overflow: hidden;">
      ${anillo(p, 130, 8)}
      <div class="una" ${aj(28)} style="${FRAUNCES} font-style: italic; font-weight: 800; font-size: 46px; color: ${V.verde};">${e(it.nombre || (p ? nombreCorto(p) : 'Ingrediente'))}</div>
      <div ${aj(18, 3)} style="font-size: 28px; font-weight: 600; line-height: 1.35; color: ${V.gris};">${e(it.texto || p?.frase || fraseSugerida(p?.categoria))}</div>
    </div>`
    }).join('')}
  </div>`
      break
    }
    default:
      cuerpo = cierreOndas(ctx, LIMA, d.cierre, V.verde, 'Ir a la tienda →', V.verde, V.oscuro, V.oliva, r)
  }
  return `${cabeza('background: #FFFDF7;')}<div class="placa">${cuerpo}</div>${pie}`
}

export function htmlPlaca(ctx: ContextoPlaca): string {
  if (ctx.estilo === 'lanzamiento') return lanzamiento(ctx)
  if (ctx.estilo === 'nutriofertas') return nutriofertas(ctx)
  return recetas(ctx)
}
