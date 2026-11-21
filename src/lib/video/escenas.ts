// HTML de los videos animados. Puro: recibe las escenas ya armadas (textos, fotos, precios) y devuelve
// una página con todas las escenas y sus animaciones en una sola línea de tiempo.
// Las animaciones están en pausa: el motor las mueve cuadro por cuadro (grabar) o un reloj en la página (vista).
// Paleta de los carruseles aprobados (nunca la del ERP).

import { AJUSTE, escaparHtml as e } from '@/lib/piezas/html'
import { partirWeb } from '@/lib/configuracion-tipos'
import { factorRitmo, planTiempos, type EscenaTiempo } from './tipos'

export type TemaVideo = 'nutriofertas' | 'recetas' | 'lanzamiento' | 'promo'
export type PrecioVideo = { texto: string; unidad: string; antes: string | null } | null
export type EscenaVideo =
  | { tipo: 'portada'; kicker?: string | null; titulo: string[]; sub?: string | null; destacado?: string | null; texto?: string | null; sello?: string | null; boton?: string | null; fotos?: (string | null)[]; vigencia?: string | null }
  | { tipo: 'producto'; etiqueta: string; nombre: string[]; linea: string | null; precio: PrecioVideo; frase: string | null; foto: string | null; granel?: boolean; sello?: string | null; oferta?: string | null }
  | { tipo: 'lista'; titulo: string[]; bajada?: string | null; items: { foto: string | null; texto: string; detalle?: string | null; precio?: string | null }[]; oferta?: string | null }
  | { tipo: 'pasos'; titulo: string[]; pasos: string[]; foto: string | null }
  | { tipo: 'cierre'; titulo: string[]; bajada: string | null }

export type OpcionesVideo = {
  tema: TemaVideo
  escenas: EscenaVideo[]
  ancho: number
  alto: number
  maximo: number
  ritmo: 'suave' | 'dinamico'
  variante: 'auto' | '1' | '2' | '3'
  semilla: number
  contacto: { web: string; whatsapp: string; instagram: string }
  qr: string
  vista: boolean // true: se reproduce sola en la pantalla (vista previa); false: la mueve el motor
}

const V = { oscuro: '#0b3b2e', verde: '#137a52', oliva: '#6E9A35', naranja: '#ff8f00', gris: '#3e564c' }
const TEMAS: Record<TemaVideo, { fondo: string; olas: [string, string] | null; acento: string; pastilla: string; sello: string; pincel: string | null; tituloPortada: string; alinear: 'left' | 'right' }> = {
  nutriofertas: { fondo: 'background:#FFFDF7', olas: ['#FFD7A3', '#FFE9CC'], acento: V.naranja, pastilla: V.verde, sello: V.naranja, pincel: '/piezas/pincel-verde.svg', tituloPortada: V.naranja, alinear: 'right' },
  recetas: { fondo: 'background:#FFFDF7', olas: ['#CDE3BC', '#E2EFD6'], acento: V.oliva, pastilla: V.oliva, sello: V.oliva, pincel: '/piezas/pincel-lima.svg', tituloPortada: V.oscuro, alinear: 'right' },
  lanzamiento: { fondo: "background-color:#F6EFDF;background-image:url('/piezas/papel.svg')", olas: null, acento: V.naranja, pastilla: V.verde, sello: V.verde, pincel: null, tituloPortada: V.oscuro, alinear: 'left' },
  promo: { fondo: 'background:#FFFFFF', olas: null, acento: V.naranja, pastilla: V.verde, sello: V.naranja, pincel: null, tituloPortada: '#FFFFFF', alinear: 'left' },
}

const HOJITAS = (giro = 1) => `<svg width="60" height="26" viewBox="0 0 60 26" aria-hidden="true"><g fill="#fff"><ellipse cx="18" cy="13" rx="14" ry="6" transform="rotate(${-25 * giro} 18 13)"/><ellipse cx="42" cy="13" rx="14" ry="6" transform="rotate(${25 * giro} 42 13)"/></g></svg>`

function azar(semilla: number) {
  let a = semilla >>> 0 || 1
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const tiempoDe = (e: EscenaVideo): EscenaTiempo => ({ tipo: e.tipo, items: e.tipo === 'lista' ? e.items.length : e.tipo === 'pasos' ? e.pasos.length : 1 })

export function htmlVideo(o: OpcionesVideo): { html: string; total: number; omitidas: number } {
  const T = TEMAS[o.tema]
  const plan = planTiempos(o.escenas.map(tiempoDe), o.maximo, o.ritmo)
  const escenas = plan.indices.map((i) => o.escenas[i])
  const f = factorRitmo(o.ritmo)
  const H = o.alto, S = H / 1920
  const y = (v: number) => Math.round(v * S)
  const k = S < 0.9 ? 0.82 : 1 // letra algo más chica en el video de feed (4:5)
  const px = (v: number) => `${Math.round(v * k)}px`
  const r = azar(o.semilla)
  const variante = (i: number) => (o.variante === 'auto' ? (((i + Math.floor(r() * 3)) % 3) + 1) : Number(o.variante))
  const [w1, w2, w3] = partirWeb(o.contacto.web)
  const url = (d: (x: number) => string) => o.tema === 'promo' ? '' : `<div class="url a-bajar" style="${d(0)}">${e(w1)}<b>${e(w2)}</b>${e(w3)}</div>`
  const logo = (d: (x: number) => string) => o.tema === 'promo' ? '' : `<img class="logo a-fade" style="${d(0.1)}" src="/marca/circular-verde.svg" alt="">`

  let inicio = 0
  const partes = escenas.map((esc, i) => {
    const dur = plan.duraciones[i]
    const ini = inicio
    inicio += dur
    // Los tiempos internos se ajustan al largo de la escena (con ritmo dinámico, todo más rápido)
    const kt = Math.min(f, Math.max(0.35, (dur - 0.7) / 2))
    const d = (x: number) => `animation-delay:${(ini + x * kt).toFixed(2)}s`
    const v = variante(i)
    const lado: 'der' | 'izq' = v === 2 ? 'izq' : 'der'
    const entrada = i === 0 ? 'animation-duration:.001s' : `animation-name:${v === 2 ? 'desdeDer' : v === 3 ? 'acercar' : 'entrar'};animation-delay:${ini.toFixed(2)}s`
    const deco = decoracion(o.tema, T, lado, i, H, S, d, dur, kt, esc.tipo === 'portada')
    return `<section class="escena" style="${entrada}">${deco}${url(d)}${logo(d)}${cuerpo(esc, { T, tema: o.tema, lado, d, y, px, H, S, dur, kt, qr: o.qr, contacto: o.contacto })}</section>`
  })
  const total = Math.round(inicio * 100) / 100
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="pieza-tamano" content="${o.ancho}x${o.alto}"><meta name="video-duracion" content="${total}"><title>Video</title>
<style>${estilos(o, T, f)}</style></head><body>${partes.join('')}
${o.vista ? RELOJ(total) : ''}${AJUSTE}</body></html>`
  return { html, total, omitidas: plan.omitidas }
}

type Ctx = { T: (typeof TEMAS)[TemaVideo]; tema: TemaVideo; lado: 'der' | 'izq'; d: (x: number) => string; y: (v: number) => number; px: (v: number) => string; H: number; S: number; dur: number; kt: number; qr: string; contacto: OpcionesVideo['contacto'] }

function decoracion(tema: TemaVideo, T: Ctx['T'], lado: 'der' | 'izq', i: number, H: number, S: number, d: (x: number) => string, dur: number, kt: number, portada: boolean): string {
  if (T.olas) {
    const espejo = lado === 'izq' ? 'transform:scaleX(-1);' : ''
    return `<svg class="olas" width="1080" height="${H}" viewBox="0 0 1080 1920" preserveAspectRatio="none" style="position:absolute;left:0;top:0;${espejo}" aria-hidden="true">
<g class="a-olas" style="${d(0)}"><path d="M1080 0 H 380 C 470 140, 400 300, 500 430 C 610 580, 790 560, 790 760 C 790 930, 610 1030, 680 1220 C 730 1340, 930 1390, 1080 1410 Z" fill="${T.olas[0]}"/>
<path d="M1080 0 H 640 C 690 110, 640 230, 720 340 C 800 450, 950 440, 985 590 C 1010 700, 940 800, 1000 910 C 1030 970, 1060 990, 1080 1000 Z" fill="${T.olas[1]}"/></g>
<g fill="none" stroke="${V.verde}" stroke-width="7" opacity=".45"><path d="M800 1920 A 160 160 0 0 1 1120 1920"/><path d="M850 1920 A 110 110 0 0 1 1070 1920"/></g></svg>`
  }
  if (tema === 'lanzamiento') {
    // La ramita de olivo panorámica sigue de una escena a la otra, como en el carrusel
    const s = H / 1350
    const ancho = Math.round(5400 * s)
    const x = -Math.round(1080 * s * (i % 4))
    return `<img class="deco a-deriva" src="/piezas/deco-lanzamiento.svg" alt="" aria-hidden="true" style="position:absolute;left:${x}px;top:0;width:${ancho}px;height:${H}px;max-width:none;${d(0)};animation-duration:${dur.toFixed(2)}s">`
  }
  // Promo: cinta verde arriba, como el flyer
  return `<div class="banda a-bajar" style="${d(0)};height:${Math.round((portada ? 560 : 200) * S)}px"></div><img class="logo-blanco a-fade" style="${d(0.1)};${portada ? '' : `width:${Math.round(120 * S)}px;top:${Math.round(38 * S)}px`}" src="/marca/circular-blanco.svg" alt="">`
}

function plato(c: Ctx, foto: string | null, granel: boolean | undefined, x: number, top: number, tam: number, t0: number) {
  const img = foto
    ? `<img class="foto a-zoom" style="${c.d(t0)};animation-duration:${c.dur.toFixed(2)}s;${granel ? 'object-fit:cover;transform-origin:center;padding:0' : ''}" src="${e(foto)}" alt="">`
    : '<div class="falta">Sin foto</div>'
  const pincel = c.T.pincel
    ? `<img class="pincel a-pincel" style="${c.d(t0 + 0.4)};left:${Math.round(x + tam / 2 - 952 * (tam / 760))}px;top:${Math.round(top + tam / 2 - 1221 * (tam / 760))}px;width:${Math.round(1210 * (tam / 760))}px;height:${Math.round(1512 * (tam / 760))}px;${c.lado === 'izq' ? '' : 'transform:scaleX(-1)'}" src="${c.T.pincel}" alt="">`
    : ''
  const forma = c.tema === 'lanzamiento' ? 'border-radius:46% 54% 42% 58% / 52% 44% 56% 48%' : 'border-radius:50%'
  return `<div class="plato a-plato" style="${c.d(t0)};left:${x}px;top:${top}px;width:${tam}px;height:${tam}px;${forma}">${img}</div>${pincel}`
}

function sello(c: Ctx, texto: string, x: number, top: number, tam: number, t0: number) {
  return `<div class="sello a-sello" style="${c.d(t0)};left:${x}px;top:${top}px;width:${tam}px;height:${tam}px;background:${c.T.sello}"><div class="sello-in" style="width:${tam - 38}px;height:${tam - 38}px">${HOJITAS()}<b data-ajustar="20" data-lineas="3" style="font-size:${Math.round(tam * 0.22)}px">${texto.split('/').map((x) => e(x.trim())).join('<br>')}</b>${HOJITAS(-1)}</div></div>`
}

const lineasTitulo = (c: Ctx, lineas: string[], t0: number, tam: number, min: number, color: string, ultimoColor?: string) =>
  lineas.map((l, i) => `<span class="linea una a-subir" data-ajustar="${min}" style="${c.d(t0 + i * 0.16)};font-size:${c.px(tam)};color:${i === lineas.length - 1 && ultimoColor && lineas.length > 1 ? ultimoColor : color}">${e(l)}</span>`).join('')

function cuerpo(esc: EscenaVideo, c: Ctx): string {
  const { d, y, px } = c
  if (esc.tipo === 'portada') {
    if (c.tema === 'promo') {
      const fotos = (esc.fotos ?? []).filter(Boolean).slice(0, 3) as string[]
      return `<div class="p-promo">${lineasTitulo(c, esc.titulo, 0.35, 150, 70, '#fff')}</div>
<div class="vigencia a-pop" style="${d(0.8)};top:${y(640)}px">${e(esc.vigencia ?? '')}</div>
<div class="p-fotos" style="top:${y(900)}px">${fotos.map((ft, i) => `<div class="p-foto a-plato" style="${d(1 + i * 0.18)}"><img src="${e(ft)}" alt=""></div>`).join('')}</div>
${esc.texto ? `<div class="p-texto a-fade" style="${d(1.4)};top:${y(1420)}px;font-size:${px(44)}">${e(esc.texto)}</div>` : ''}
${esc.boton ? `<div class="p-boton a-pop" style="${d(1.6)};top:${y(1560)}px;font-size:${px(46)}">${e(esc.boton)}</div>` : ''}`
    }
    const der = c.T.alinear === 'right'
    const fotos = (esc.fotos ?? []).filter(Boolean) as string[]
    const cuantos = fotos.length
    const col = `<div class="columna" style="top:${y(c.tema === 'lanzamiento' ? 300 : 360)}px;${der ? 'right:70px;align-items:flex-end;text-align:right' : 'left:70px;align-items:flex-start;text-align:left'}">
${esc.kicker ? `<div class="kicker a-subir" style="${d(0.25)};font-size:${px(60)};color:${c.T.acento}">${e(esc.kicker)}</div>` : ''}
${lineasTitulo(c, esc.titulo, 0.35, c.tema === 'nutriofertas' ? 220 : 150, 70, c.T.tituloPortada, c.tema === 'recetas' ? V.oliva : c.tema === 'lanzamiento' ? V.naranja : undefined)}
${esc.sub ? `<div class="sub a-fade" style="${d(0.85)};font-size:${px(40)}">${e(esc.sub)}</div>` : ''}
${esc.destacado ? `<div class="destacado a-fade" style="${d(1)};font-size:${px(46)}">${e(esc.destacado)}</div>` : ''}
${esc.texto ? `<div class="texto-p a-fade" data-ajustar="24" data-lineas="4" style="${d(1.15)};font-size:${px(38)}">${e(esc.texto)}</div>` : ''}
${esc.boton ? `<div class="boton a-pop" style="${d(1.45)};font-size:${px(44)};background:${c.T.acento}">${e(esc.boton)}</div>` : ''}</div>`
    const tam = Math.round(Math.min(560, c.H * 0.29))
    const topFoto = c.H - tam - y(110)
    const fotosHtml = cuantos
      ? fotos.slice(0, 2).map((ft, i) => plato({ ...c, lado: der ? 'izq' : 'der' }, ft, false, der ? 70 + i * 380 : 1080 - tam - 70 - i * 380, topFoto - i * y(70), i ? Math.round(tam * 0.75) : tam, 0.9 + i * 0.2)).join('')
      : ''
    const tamSello = y(cuantos ? 270 : 330)
    const selloHtml = esc.sello
      ? sello(c, esc.sello, cuantos ? (der ? Math.min(1080 - tamSello - 40, 70 + tam - Math.round(tamSello * 0.35)) : Math.max(40, 1080 - 70 - tam - Math.round(tamSello * 0.65))) : der ? 90 : 760, cuantos ? topFoto - Math.round(tamSello * 0.45) : c.H - y(760), tamSello, 1.1)
      : ''
    return col + fotosHtml + selloHtml
  }
  if (esc.tipo === 'producto') {
    const tam = Math.round(Math.min(760, c.H * 0.4))
    const x = c.lado === 'izq' ? 70 : 1080 - tam - 70
    const top = c.H - tam - y(220)
    const precio = esc.precio
      ? `${esc.precio.antes ? `<div class="antes a-fade" style="${d(1.15)};font-size:${px(36)}">antes <span class="tachado">${e(esc.precio.antes)}<i class="raya a-raya" style="${d(1.45)}"></i></span></div>` : ''}
<div class="rotulo a-fade" style="${d(1.3)};font-size:${px(28)};color:${c.T.acento}">${c.tema === 'promo' ? 'Precio promo' : 'Precio NutriOferta'}</div>
<div class="precio a-pop una" data-ajustar="40" style="${d(1.4)};font-size:${px(78)}">${e(esc.precio.texto)}${esc.precio.unidad ? ` <small>${e(esc.precio.unidad)}</small>` : ''}</div>`
      : ''
    const etiqueta = c.tema === 'lanzamiento'
      ? `<div class="washi a-pop" style="${d(0.45)}">${e(esc.etiqueta)}</div>`
      : `<div class="etiqueta a-subir" style="${d(0.45)};font-size:${px(60)};color:${c.T.acento}">${e(esc.etiqueta)}</div>`
    const oferta = esc.oferta ? `<div class="oferta a-sello" style="${d(1.6)};left:${c.lado === 'izq' ? 1080 - 70 - y(300) : 70}px;top:${top + y(40)}px;font-size:${px(72)}">${e(esc.oferta)}</div>` : ''
    return `${plato(c, esc.foto, esc.granel, x, top, tam, 0.15)}
${esc.sello ? sello(c, esc.sello, c.lado === 'izq' ? Math.min(1080 - y(270), x + tam - y(40)) : Math.max(30, x - y(60)), top - y(60), y(250), 1.6) : ''}${oferta}
<div class="texto" style="top:${y(c.tema === 'promo' ? 260 : 230)}px">${etiqueta}
<h2>${lineasTitulo(c, esc.nombre, 0.6, 140, 60, V.oscuro)}</h2>
${esc.linea ? `<div class="chica a-fade una" data-ajustar="18" style="${d(0.95)};font-size:${px(34)}">${e(esc.linea)}</div>` : ''}
${precio}
${esc.frase ? `<div class="frase a-fade" data-ajustar="22" data-lineas="4" style="${d(1.8)};font-size:${px(34)};width:${c.lado === 'izq' ? 940 : 460}px">${e(esc.frase)}</div>` : ''}</div>`
  }
  if (esc.tipo === 'lista') {
    const n = Math.max(1, esc.items.length)
    const desde = y(560)
    const alto = Math.min(y(230), Math.floor((c.H - desde - y(260)) / n))
    const filas = esc.items.map((it, i) => `<div class="fila a-desdeIzq" style="${d(0.9 + i * 0.42)};top:${desde + i * alto}px;height:${alto - 16}px">
<div class="fila-foto" style="width:${alto - 30}px;height:${alto - 30}px">${it.foto ? `<img src="${e(it.foto)}" alt="">` : ''}</div>
<div class="fila-texto"><b class="una" data-ajustar="24" style="font-size:${px(Math.min(48, alto * 0.24))}">${e(it.texto)}</b>${it.detalle ? `<span class="una" data-ajustar="16" style="font-size:${px(Math.min(32, alto * 0.17))}">${e(it.detalle)}</span>` : ''}</div>
${it.precio ? `<div class="fila-precio una" data-ajustar="24" style="font-size:${px(Math.min(46, alto * 0.24))}">${e(it.precio)}</div>` : ''}</div>`).join('')
    return `<div class="texto" style="top:${y(c.tema === 'promo' ? 300 : 230)}px"><h2>${lineasTitulo(c, esc.titulo, 0.3, 110, 50, V.oscuro, c.T.acento)}</h2>
${esc.bajada ? `<div class="chica a-fade" style="${d(0.6)};font-size:${px(34)}">${e(esc.bajada)}</div>` : ''}</div>
${esc.oferta ? `<div class="oferta a-sello" style="${d(0.7)};right:70px;top:${y(c.tema === 'promo' ? 300 : 230)}px;font-size:${px(64)}">${e(esc.oferta)}</div>` : ''}${filas}`
  }
  if (esc.tipo === 'pasos') {
    const n = Math.max(1, esc.pasos.length)
    const desde = y(560)
    const tamFoto = esc.foto ? Math.round(Math.min(520, c.H * 0.27)) : 0
    const alto = Math.floor((c.H - desde - y(200) - tamFoto * 0.6) / n)
    const pasos = esc.pasos.map((p, i) => `<div class="paso a-subir" style="${d(0.8 + i * 0.6)};top:${desde + i * alto}px"><span class="num" style="background:${c.T.acento}">${i + 1}</span><span data-ajustar="24" data-lineas="3" style="font-size:${px(42)}">${e(p)}</span></div>`).join('')
    const foto = esc.foto ? plato(c, esc.foto, false, 1080 - tamFoto - 60, c.H - tamFoto - y(90), tamFoto, 0.5) : ''
    return `<div class="texto" style="top:${y(230)}px"><h2>${lineasTitulo(c, esc.titulo, 0.3, 110, 50, V.oscuro, c.T.acento)}</h2>
<div class="chica a-fade" style="${d(0.55)};font-size:${px(34)}">En ${n} ${n === 1 ? 'paso' : 'pasos'}</div></div>${foto}${pasos}`
  }
  // Cierre: tienda, WhatsApp, Instagram y el QR (siempre bien visibles)
  return `<div class="c-centro" style="top:${y(c.tema === 'promo' ? 330 : 300)}px">${lineasTitulo(c, esc.titulo, 0.2, 120, 56, V.oscuro, c.T.acento)}
${esc.bajada ? `<div class="a-fade" style="${d(0.6)};font-size:${px(42)};font-weight:700;margin-top:26px;color:${V.gris}">${e(esc.bajada)}</div>` : ''}</div>
<div class="c-qr a-pop" style="${d(0.7)};top:${y(860)}px;width:${y(400)}px;height:${y(400)}px;left:${540 - y(200)}px"><img src="${c.qr}" alt="QR de la tienda"></div>
<div class="c-datos" style="top:${y(1340)}px;font-size:${px(44)}"><div class="c-tienda a-pop" style="${d(1)};font-size:${px(46)};background:${c.T.pastilla}">${e(c.contacto.web)}</div><div class="a-fade" style="${d(1.2)}">WhatsApp ${e(c.contacto.whatsapp)} · ${e(c.contacto.instagram)}</div></div>
<img class="c-logo a-fade" style="${d(1.4)};top:${y(1640)}px" src="/marca/circular-verde.svg" alt="">`
}

function estilos(o: OpcionesVideo, T: (typeof TEMAS)[TemaVideo], f: number): string {
  const H = o.alto, S = H / 1920
  const y = (v: number) => Math.round(v * S)
  const ease = o.ritmo === 'dinamico' ? 'cubic-bezier(.3,1.5,.5,1)' : 'cubic-bezier(.3,1.25,.5,1)'
  const dur = (s: number) => `${(s * f).toFixed(2)}s`
  return `@font-face { font-family: Fraunces; src: url('/fuentes/fraunces-latin-italica.woff2') format('woff2'); font-weight: 100 900; font-style: italic; }
@font-face { font-family: Nunito; src: url('/fuentes/nunito-latin.woff2') format('woff2'); font-weight: 200 1000; }
*{box-sizing:border-box} body{margin:0;width:${o.ancho}px;height:${H}px;overflow:hidden;background:#FFFDF7;font-family:Nunito,system-ui,sans-serif;color:${V.oscuro}}
.una{white-space:nowrap;overflow:hidden}
.escena{position:absolute;inset:0;overflow:hidden;${T.fondo};animation:entrar .6s cubic-bezier(.2,.8,.2,1) both paused;box-shadow:0 -30px 60px rgba(0,0,0,.12)}
.url{position:absolute;left:50px;top:${y(70)}px;padding:14px 30px;border-radius:999px;background:${T.pastilla};color:#fff;font-size:${y(32)}px;font-weight:800;z-index:3}
.url b{color:#FFE2B8}
.logo{position:absolute;right:70px;top:${y(60)}px;width:${y(170)}px;z-index:3}
.banda{position:absolute;left:0;top:0;width:100%;height:${y(560)}px;background:${V.verde};border-radius:0 0 60px 60px}
.logo-blanco{position:absolute;left:70px;top:${y(60)}px;width:${y(170)}px}
.p-promo{position:absolute;left:70px;right:70px;top:${y(270)}px;display:flex;flex-direction:column}
.p-promo .linea{font-family:Nunito,sans-serif;font-style:italic;font-weight:900;text-transform:uppercase;line-height:1}
.vigencia{position:absolute;left:70px;padding:18px 40px;border-radius:999px;background:${V.naranja};color:#fff;font-size:${y(52)}px;font-weight:900;box-shadow:0 0 0 10px #fff}
.p-fotos{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:30px}
.p-foto{position:relative;width:${y(330)}px;height:${y(330)}px;border-radius:50%;overflow:hidden;background:#fff;border:10px solid #fff;box-shadow:0 20px 50px rgba(40,60,30,.22)}
.p-foto img{width:100%;height:100%;object-fit:contain;padding:30px}
.p-texto{position:absolute;left:70px;right:70px;text-align:center;font-weight:700;color:${V.gris}}
.p-boton{position:absolute;left:50%;transform:translateX(-50%);padding:22px 50px;border-radius:999px;background:${V.naranja};color:#fff;font-weight:900;white-space:nowrap}
.deco{opacity:.95}
.columna{position:absolute;width:940px;display:flex;flex-direction:column;z-index:2}
.columna .linea{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:800;line-height:1;max-width:940px}
.kicker{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:800;margin-bottom:10px}
.sub{letter-spacing:9px;font-weight:700;margin-top:26px;text-transform:uppercase}
.destacado{letter-spacing:6px;font-weight:900;margin-top:10px;text-transform:uppercase}
.texto-p{font-weight:600;line-height:1.35;margin-top:22px;color:${V.gris};max-width:520px}
.boton{margin-top:34px;padding:20px 44px;border-radius:999px;color:#fff;font-weight:900;white-space:nowrap}
.plato{position:absolute;overflow:hidden;background:#fff;border:22px solid #fff;box-shadow:0 34px 70px rgba(40,60,30,.28);z-index:1}
.foto{width:100%;height:100%;object-fit:contain;padding:14%;display:block;background:#fff}
.falta{display:grid;place-items:center;width:100%;height:100%;background:#eee;color:#999;font:800 34px Nunito}
.pincel{position:absolute;z-index:2;pointer-events:none}
.sello{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 14px rgba(255,255,255,.7);z-index:3}
.sello-in{border-radius:50%;border:3px solid rgba(255,255,255,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:12px}
.sello-in b{font-family:Fraunces,serif;font-style:italic;font-weight:800;line-height:1.02;max-width:100%}
.texto{position:absolute;left:70px;width:940px;z-index:4}
.etiqueta{font-family:Fraunces,serif;font-style:italic;font-weight:800}
.washi{display:inline-block;padding:12px 34px;background:#FFE2B8;color:${V.oscuro};font-weight:900;font-size:${y(36)}px;text-transform:uppercase;letter-spacing:3px;transform:rotate(-3deg);box-shadow:0 6px 14px rgba(0,0,0,.08)}
h2{margin:6px 0 0;font-family:Fraunces,serif;font-style:italic;font-weight:800;line-height:1.02}
.linea{display:block;max-width:940px}
.chica{margin-top:18px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${V.gris};max-width:940px}
.antes{margin-top:30px;font-weight:800;color:${V.gris}}
.tachado{position:relative;display:inline-block}.raya{position:absolute;left:-4px;right:-4px;top:52%;height:4px;background:${V.gris};transform-origin:left}
.rotulo{margin-top:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase}
.precio{display:inline-block;margin-top:10px;padding:16px 42px;border-radius:999px;background:${V.oscuro};color:#fff;font-weight:900;transform-origin:left center;max-width:760px}
.precio small{font-size:.5em;font-weight:800;opacity:.85}
.frase{margin-top:24px;font-weight:600;line-height:1.4;color:${V.gris}}
.oferta{position:absolute;padding:18px 34px;border-radius:28px;background:${V.naranja};color:#fff;font-weight:900;font-style:italic;box-shadow:0 0 0 10px rgba(255,255,255,.75);z-index:3;white-space:nowrap}
.fila{position:absolute;left:70px;right:70px;display:flex;align-items:center;gap:26px;padding:8px 26px 8px 8px;background:rgba(255,255,255,.88);border-radius:999px;box-shadow:0 12px 30px rgba(40,60,30,.12)}
.fila-foto{flex:none;border-radius:50%;overflow:hidden;background:#fff}.fila-foto img{width:100%;height:100%;object-fit:contain;padding:12%}
.fila-texto{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.fila-texto b{font-weight:900}.fila-texto span{color:${V.gris};font-weight:700}
.fila-precio{flex:none;padding:10px 26px;border-radius:999px;background:${V.oscuro};color:#fff;font-weight:900;max-width:340px}
.paso{position:absolute;left:70px;right:70px;display:flex;gap:26px;align-items:flex-start;font-weight:700;line-height:1.3}
.paso .num{flex:none;width:${y(76)}px;height:${y(76)}px;border-radius:50%;color:#fff;display:grid;place-items:center;font-weight:900;font-size:${y(40)}px}
.paso span:last-child{max-width:900px}
.c-centro{position:absolute;left:70px;right:70px;text-align:center;display:flex;flex-direction:column;align-items:center}
.c-centro .linea{font-family:Fraunces,serif;font-style:italic;font-weight:800;line-height:1.02;max-width:940px}
.c-qr{position:absolute;padding:26px;background:#fff;border-radius:34px;box-shadow:0 26px 60px rgba(40,60,30,.22)}.c-qr img{width:100%;height:100%;display:block}
.c-datos{position:absolute;left:0;right:0;text-align:center;font-weight:800;line-height:1.7}
.c-tienda{display:inline-block;padding:18px 44px;border-radius:999px;color:#fff;font-weight:900;margin-bottom:20px}
.c-logo{position:absolute;left:${540 - y(100)}px;width:${y(200)}px}
.a-fade,.a-subir,.a-bajar,.a-desdeIzq,.a-pop,.a-plato,.a-zoom,.a-pincel,.a-sello,.a-raya,.a-olas,.a-deriva{animation-fill-mode:both;animation-play-state:paused}
.a-fade{animation-name:fade;animation-duration:${dur(0.5)}}
.a-subir{animation-name:subir;animation-duration:${dur(0.6)};animation-timing-function:cubic-bezier(.2,.8,.2,1)}
.a-bajar{animation-name:bajar;animation-duration:${dur(0.5)};animation-timing-function:cubic-bezier(.2,.8,.2,1)}
.a-desdeIzq{animation-name:desdeIzq;animation-duration:${dur(0.55)};animation-timing-function:cubic-bezier(.2,.8,.2,1)}
.a-pop{animation-name:pop;animation-duration:${dur(0.55)};animation-timing-function:${ease}}
.a-plato{animation-name:plato;animation-duration:${dur(0.7)};animation-timing-function:${ease}}
.a-zoom{animation-name:zoom;animation-timing-function:linear}
.a-pincel{animation-name:pincel;animation-duration:${dur(0.8)};animation-timing-function:cubic-bezier(.5,0,.3,1)}
.a-sello{animation-name:sello;animation-duration:${dur(0.6)};animation-timing-function:${ease}}
.a-raya{animation-name:raya;animation-duration:${dur(0.35)}}
.a-olas{animation-name:olas;animation-duration:${dur(1.1)};animation-timing-function:cubic-bezier(.2,.8,.2,1)}
.a-deriva{animation-name:deriva;animation-timing-function:linear}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes subir{from{opacity:0;transform:translateY(70px)}to{opacity:1;transform:none}}
@keyframes bajar{from{opacity:0;transform:translateY(-60px)}to{opacity:1;transform:none}}
@keyframes desdeIzq{from{opacity:0;transform:translateX(-120px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes plato{from{opacity:0;transform:scale(.55) translateY(120px)}to{opacity:1;transform:none}}
@keyframes zoom{from{transform:scale(1)}to{transform:scale(1.08)}}
@keyframes pincel{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes sello{from{opacity:0;transform:scale(.3) rotate(-40deg)}to{opacity:1;transform:rotate(7deg)}}
@keyframes raya{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes olas{from{transform:translate(260px,-320px)}to{transform:none}}
@keyframes deriva{from{transform:translateX(0)}to{transform:translateX(-90px)}}
@keyframes entrar{from{transform:translateY(100%)}to{transform:none}}
@keyframes desdeDer{from{transform:translateX(100%)}to{transform:none}}
@keyframes acercar{from{opacity:0;transform:scale(1.12)}to{opacity:1;transform:none}}`
}

/** Vista previa: un reloj mueve todas las animaciones y vuelve a empezar al terminar. */
const RELOJ = (total: number) => `<script>(async () => {
  await document.fonts.ready
  while (!document.documentElement.dataset.listo) await new Promise((r) => setTimeout(r, 50))
  const t0 = performance.now(), total = ${total} * 1000 + 800
  const paso = () => { const t = (performance.now() - t0) % total; for (const a of document.getAnimations()) { a.currentTime = t } requestAnimationFrame(paso) }
  requestAnimationFrame(paso)
})()</script>`
