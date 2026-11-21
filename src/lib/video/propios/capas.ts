// HTML de lo que va encima de los videos propios: logo, tienda, franjas de productos, sellos y textos.
// Puro. Cada capa está en su lugar final (data-capa): el motor saca una foto de cada una con fondo transparente
// y ffmpeg las anima. En la vista previa (vista) las capas se animan acá mismo, con una línea de tiempo
// en pausa que mueve la pantalla según el segundo del video.
// Paleta de los carruseles aprobados (nunca la del ERP).

import { AJUSTE, ajustar, escaparHtml as e } from '@/lib/piezas/html'
import { partirWeb } from '@/lib/configuracion-tipos'
import type { ContenidoVideo } from '@/lib/db/esquema'
import type { AnimacionCapa } from './reglas'

export type TemaCapas = ContenidoVideo['estilo']
export type ProductoCapa = { id?: number; nombre: string[]; linea: string | null; precio: { texto: string; unidad: string; antes: string | null } | null; foto: string | null; sello: string | null; desde: number; hasta: number }
export type TextoCapa = { texto: string; desde: number; hasta: number }
export type OpcionesCapas = {
  tema: TemaCapas
  ancho: number
  alto: number
  web: string
  productos: ProductoCapa[]
  textos: TextoCapa[]
  medio: number
  vista: boolean
}
export type CapaDeclarada = { id: string; animacion: AnimacionCapa; desde: number; hasta: number }

const V = { oscuro: '#0b3b2e', verde: '#137a52', oliva: '#6E9A35', naranja: '#ff8f00', gris: '#3e564c' }
const TEMAS: Record<TemaCapas, { tarjeta: string; aro: string; precio: string; sello: string; texto: string; textoColor: string; textoGiro: number; url: string; logo: string; logoAro: string }> = {
  nutriofertas: { tarjeta: '#FFFDF7', aro: '#FFE9CC', precio: V.verde, sello: V.naranja, texto: V.naranja, textoColor: '#fff', textoGiro: -4, url: V.oscuro, logo: '/marca/circular-verde.svg', logoAro: '#fff' },
  recetas: { tarjeta: '#FFFDF7', aro: '#E2EFD6', precio: V.oliva, sello: V.oliva, texto: V.oliva, textoColor: '#fff', textoGiro: -3, url: V.oscuro, logo: '/marca/circular-verde.svg', logoAro: '#fff' },
  lanzamiento: { tarjeta: '#F6EFDF', aro: '#FFE2B8', precio: V.verde, sello: V.verde, texto: '#FFE2B8', textoColor: V.oscuro, textoGiro: -3, url: V.oscuro, logo: '/marca/circular-verde.svg', logoAro: '#fff' },
  promo: { tarjeta: '#FFFFFF', aro: '#dcefe3', precio: V.oscuro, sello: V.naranja, texto: V.verde, textoColor: '#fff', textoGiro: 0, url: V.verde, logo: '/marca/circular-blanco.svg', logoAro: V.verde },
}
const HOJITAS = `<svg width="54" height="22" viewBox="0 0 60 26" aria-hidden="true"><g fill="#fff"><ellipse cx="18" cy="13" rx="14" ry="6" transform="rotate(-25 18 13)"/><ellipse cx="42" cy="13" rx="14" ry="6" transform="rotate(25 42 13)"/></g></svg>`

/** Dónde va la franja de producto (arriba de la zona que tapan los botones de Instagram). */
export const arribaFranja = (alto: number) => Math.round(alto * 0.655)

export function htmlCapas(o: OpcionesCapas): { html: string; capas: CapaDeclarada[] } {
  const T = TEMAS[o.tema]
  const S = o.alto / 1920
  const y = (v: number) => Math.round(v * S)
  const k = S < 0.9 ? 0.86 : 1
  const px = (v: number) => `${Math.round(v * k)}px`
  const [w1, w2, w3] = partirWeb(o.web)
  const capas: CapaDeclarada[] = []
  const keyframes: string[] = []
  const dur = Math.max(0.1, o.medio)
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / dur) * 100)).toFixed(3)}%`
  // Vista previa: cada capa con su propia animación a lo largo de todo el video (en pausa; la mueve la pantalla)
  const animar = (id: string, a: AnimacionCapa, desde: number, hasta: number) => {
    capas.push({ id, animacion: a, desde, hasta })
    if (!o.vista) return ''
    const n = `k-${id}`
    const fuera = a === 'izquierda' ? 'transform:translateX(-1300px)' : a === 'arriba' ? 'transform:translateY(-900px)' : 'opacity:0'
    const dentro = a === 'izquierda' || a === 'arriba' ? 'transform:none' : 'opacity:1'
    if (a === 'fijo') keyframes.push(`@keyframes ${n}{0%{opacity:0}${pct(0.4)}{opacity:1}100%{opacity:1}}`)
    else {
      const d = a === 'aparecer' ? desde + 0.35 : desde
      const entra = a === 'aparecer' ? 0.25 : 0.45
      const sale = a === 'aparecer' ? Math.max(d + 0.25, hasta - 0.35) : hasta - 0.35
      keyframes.push(`@keyframes ${n}{0%{${fuera}}${pct(d)}{${fuera};animation-timing-function:ease-out}${pct(d + entra)}{${dentro}}${pct(sale)}{${dentro};animation-timing-function:ease-in}${pct(a === 'aparecer' ? sale + 0.25 : hasta)}{${fuera}}100%{${fuera}}}`)
    }
    return `animation:${n} ${dur}s linear both paused;`
  }

  const partes: string[] = []
  partes.push(`<div class="capa url" data-capa="url" style="${animar('url', 'fijo', 0, o.medio)}left:40px;top:${y(44)}px">${e(w1)}<b>${e(w2)}</b>${e(w3)}</div>`)
  partes.push(`<div class="capa logo" data-capa="logo" style="${animar('logo', 'fijo', 0, o.medio)}right:40px;top:${y(30)}px"><img src="${T.logo}" alt=""></div>`)

  const arriba = arribaFranja(o.alto)
  o.productos.forEach((p, i) => {
    const precio = p.precio
      ? `<div class="p">${p.precio.antes ? `<span class="a">${e(p.precio.antes)}</span>` : ''}<span class="pr">${e(p.precio.texto)}${p.precio.unidad ? ` <small>${e(p.precio.unidad)}</small>` : ''}</span></div>`
      : ''
    partes.push(`<div class="capa franja" data-capa="p${i}" style="${animar(`p${i}`, 'izquierda', p.desde, p.hasta)}left:70px;top:${arriba}px">${p.foto ? `<div class="f"><img src="${e(p.foto)}" alt=""></div>` : ''}<div class="t"><h3 ${ajustar(30, 2)}>${p.nombre.map((l) => `<span class="ln">${e(l)}</span>`).join(' ')}</h3>${p.linea ? `<div class="l" ${ajustar(16)}>${e(p.linea)}</div>` : ''}${precio}</div></div>`)
    if (p.sello) partes.push(`<div class="capa sello" data-capa="s${i}" style="${animar(`s${i}`, 'aparecer', p.desde, p.hasta)}left:${70 + 940 - 170}px;top:${arriba - y(168)}px"><div>${HOJITAS}<b ${ajustar(28)}>${e(p.sello)}</b></div></div>`)
  })
  o.textos.forEach((t, i) => {
    partes.push(`<div class="capa texto-libre" data-capa="t${i}" style="${animar(`t${i}`, 'arriba', t.desde, t.hasta)}left:0;right:0;top:${y(300)}px"><span ${ajustar(48)}>${e(t.texto)}</span></div>`)
  })

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="pieza-tamano" content="${o.ancho}x${o.alto}"><title>Capas</title>
<style>
@font-face{font-family:Fraunces;src:url('/fuentes/fraunces-latin-italica.woff2') format('woff2');font-weight:100 900;font-style:italic}
@font-face{font-family:Nunito;src:url('/fuentes/nunito-latin.woff2') format('woff2');font-weight:200 1000}
*{box-sizing:border-box}
html,body{margin:0;width:${o.ancho}px;height:${o.alto}px;background:transparent;overflow:hidden;font-family:Nunito,sans-serif}
.capa{position:absolute}
.url{padding:14px 28px;border-radius:999px;background:${T.url};color:#fff;font-weight:700;font-size:${px(30)};box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:nowrap}
.url b{font-weight:900}
.logo{width:${px(180)};height:${px(180)};border-radius:50%;background:${T.logoAro};display:grid;place-items:center;box-shadow:0 10px 28px rgba(0,0,0,.28)}
.logo img{width:80%}
.franja{width:940px;display:flex;align-items:center;gap:28px;padding:18px 34px 18px 18px;background:${T.tarjeta};border-radius:40px;box-shadow:0 20px 50px rgba(0,0,0,.30)}
.franja .f{flex:none;width:${px(190)};height:${px(190)};border-radius:50%;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 6px ${T.aro}}
.franja .f img{width:100%;height:100%;object-fit:contain;padding:18px}
.franja .t{flex:1;min-width:0;display:flex;flex-direction:column}
.franja h3{margin:0;font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:800;font-size:${px(56)};line-height:1.02;color:${V.oscuro};max-width:100%}
.franja .l{margin-top:8px;font-weight:700;font-size:${px(24)};letter-spacing:4px;text-transform:uppercase;color:${V.gris};white-space:nowrap;overflow:hidden;max-width:100%}
.franja .p{margin-top:14px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.franja .a{font-weight:800;font-size:${px(30)};color:${V.gris};text-decoration:line-through;text-decoration-thickness:3px}
.franja .pr{padding:10px 30px;border-radius:999px;background:${T.precio};color:#fff;font-weight:900;font-size:${px(46)};white-space:nowrap}
.franja .pr small{font-size:.52em;font-weight:800;opacity:.85}
.sello{width:${px(200)};height:${px(200)};border-radius:50%;background:${T.sello};display:grid;place-items:center;box-shadow:0 0 0 12px rgba(255,255,255,.75)}
.sello>div{width:84%;height:84%;border-radius:50%;border:3px solid rgba(255,255,255,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:8px;gap:2px}
.sello b{font-family:Fraunces,serif;font-style:italic;font-weight:800;font-size:${px(52)};line-height:1;max-width:100%;white-space:nowrap;overflow:hidden}
.texto-libre{display:flex;justify-content:center}
.texto-libre span{display:inline-block;max-width:900px;padding:18px 54px 26px;border-radius:36px;background:${T.texto};color:${T.textoColor};font-family:Fraunces,serif;font-style:italic;font-weight:800;font-size:${px(100)};line-height:1;white-space:nowrap;overflow:hidden;transform:rotate(${T.textoGiro}deg);box-shadow:0 0 0 12px rgba(255,255,255,.8),0 20px 40px rgba(0,0,0,.25)}
${keyframes.join('\n')}
</style></head><body>${partes.join('\n')}${AJUSTE}</body></html>`
  return { html, capas }
}
