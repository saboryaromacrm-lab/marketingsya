// HTML del flyer de promociones (1080 de ancho). Lo abre Chromium para pasarlo a JPEG
// y se ve igual en la vista previa del editor. Paleta de los carruseles aprobados (nunca la del ERP).
// Las alturas son fijas y coinciden con ALTO (calculo.ts): así la paginación es exacta.

import { aireDePlaca, ALTO, MEDIDAS, POR_LINEA, type Formato } from './calculo'
import { CONTACTO, escaparHtml as e, PALETA } from '@/lib/piezas/html'

export type ItemFlyer = { nombre: string; tam: string | null; foto: string | null; precio: string | null; antes: string | null }
export type BloqueFlyer =
  | { tipo: 'producto'; nombre: string; oferta: string; item: ItemFlyer }
  | { tipo: 'variantes'; nombre: string; oferta: string; variantes: string[]; item: ItemFlyer }
  | { tipo: 'grupo'; titulo: string; oferta: string; items: ItemFlyer[]; continuacion: boolean }

export type DatosFlyer = {
  titulo: string
  vigencia: string // «DEL 18/11 AL 30/11»
  diseno: '1' | '2'
  formato: Formato
  bloques: BloqueFlyer[]
  pagina: number
  paginas: number
  borrador?: boolean
}

const CALENDARIO = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h3v3H7z"/></svg>'
const altoGrupo = (n: number) => {
  const lineas = Math.ceil(n / POR_LINEA)
  return ALTO.grupoBase + lineas * ALTO.grupoLinea + (lineas - 1) * ALTO.grupoEntreLineas
}

function caja(item: ItemFlyer, clase = '') {
  return `<div class="caja ${clase}">${item.foto ? `<img src="${e(item.foto)}" alt="">` : '<span class="sin-foto">Sin foto</span>'}</div>`
}

function cuadroPrecio(item: ItemFlyer, conAntes = false) {
  if (!item.precio) return '<div class="precio"><div>PRECIO PROMO</div><b class="sin-precio">Consultar</b></div>'
  return `<div class="precio"><div>PRECIO PROMO</div><b>${e(item.precio)}</b><small>${conAntes && item.antes ? `antes <s>${e(item.antes)}</s>` : 'c/u'}</small></div>`
}

// «3 × $ 2.300» no entra con la letra de «-10%»: las etiquetas largas van más chicas
const claseOferta = (t: string) => (t.length > 9 ? 'oferta oferta-muy-larga' : t.length > 6 ? 'oferta oferta-larga' : 'oferta')

function bloqueHtml(b: BloqueFlyer): string {
  if (b.tipo === 'grupo') {
    const cols = b.items
      .map((it) => `<div class="col">${caja(it)}<div class="nombre-col">${e(it.nombre)}${it.tam ? `<span class="tam">${e(it.tam)}</span>` : ''}</div><div class="pildora">${it.precio ? e(it.precio) : 'Consultar'}<small>c/u</small></div></div>`)
      .join('')
    return `<div class="grupo" style="height:${altoGrupo(b.items.length)}px"><div class="pestana">${e(b.titulo)}${b.continuacion ? ' (sigue)' : ''}</div><div class="${claseOferta(b.oferta)}">${e(b.oferta)}</div><div class="columnas">${cols}</div></div>`
  }
  const variantes = b.tipo === 'variantes' && b.variantes.length
    ? `<div class="variantes">${b.variantes.slice(0, 3).map((v) => `<span>${e(v)}</span>`).join('')}${b.variantes.length > 3 ? `<span>y ${b.variantes.length - 3} más</span>` : ''}</div>`
    : ''
  return `<div class="fila">${caja(b.item)}<div class="centro"><div class="nombre ${variantes ? 'nombre-corto' : ''}">${e(b.nombre)}</div>${variantes}</div><div class="divisor"></div><div class="lado"><div class="${claseOferta(b.oferta)}">${e(b.oferta)}</div>${cuadroPrecio(b.item)}</div></div>`
}

function cabeza(d: DatosFlyer) {
  const fecha = `<div class="fecha">${CALENDARIO}${e(d.vigencia)}</div>`
  if (d.diseno === '2') {
    return `<div class="cabeza2"><div class="cinta2"><img src="/marca/circular-blanco.svg" alt="Sabor y Aroma"><h1>${e(d.titulo)}</h1></div>${fecha}</div>`
  }
  return `<div class="cabeza">
    <div class="hoja" style="left:-60px;top:-40px;width:260px;height:150px;background:${PALETA.oliva};transform:rotate(-20deg)"></div>
    <div class="hoja" style="left:-40px;top:70px;width:200px;height:110px;background:${PALETA.verde2};transform:rotate(25deg)"></div>
    <div class="logo"><img src="/marca/circular-verde.svg" alt="Sabor y Aroma"></div>
    <div class="cinta"><h1>${e(d.titulo)}</h1></div>
    <svg class="rayitas" width="70" height="60" viewBox="0 0 70 60"><path d="M10 50 L22 14 M34 50 L46 4 M56 52 L66 26" stroke="${PALETA.naranja}" stroke-width="8" stroke-linecap="round"/></svg>
    ${fecha}</div>`
}

function pie(d: DatosFlyer) {
  if (d.diseno === '2') {
    return `<div class="pie2"><img src="/marca/horizontal-blanco.svg" alt="Sabor y Aroma"><div class="datos"><span>${e(CONTACTO.web)}</span><span>${e(CONTACTO.whatsapp)} · ${e(CONTACTO.instagram)}</span></div></div>`
  }
  return `<div class="pie"><span><i>●</i> ${e(CONTACTO.web)}</span><span><i>●</i> ${e(CONTACTO.whatsapp)}</span><span><i>●</i> ${e(CONTACTO.instagram)}</span></div>`
}

function uno(d: DatosFlyer) {
  const b = d.bloques[0]
  if (!b) return ''
  const item = b.tipo === 'grupo' ? b.items[0] : b.item
  const nombre = b.tipo === 'grupo' ? `${b.titulo} ${item.nombre}${item.tam ? ` ${item.tam}` : ''}` : b.nombre
  return `<div class="uno">${caja(item, 'caja-grande')}<div class="nombre-grande">${e(nombre)}</div><div class="fila-precio"><div class="oferta">${e(b.oferta)}</div>${cuadroPrecio(item, true)}</div></div>`
}

export function htmlFlyer(d: DatosFlyer): string {
  const { alto } = MEDIDAS[d.formato]
  let cuerpo: string
  if (d.formato === 'uno') cuerpo = uno(d)
  else {
    const altos = d.bloques.map((b) => (b.tipo === 'grupo' ? altoGrupo(b.items.length) : ALTO.fila))
    const aire = aireDePlaca(altos, d.bloques[0]?.tipo === 'grupo', d.formato, d.diseno)
    cuerpo = `<div class="lista" style="padding-top:${aire.arriba}px;gap:${aire.entre}px">${d.bloques.map(bloqueHtml).join('')}</div>`
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="pieza-tamano" content="1080x${alto}"><title>Promo</title><style>${css(alto)}</style></head><body class="d${d.diseno}">
${d.borrador ? '<span class="borrador">VISTA PREVIA</span>' : ''}${d.paginas > 1 ? `<span class="numero">${d.pagina}/${d.paginas}</span>` : ''}
${cabeza(d)}${cuerpo}${pie(d)}</body></html>`
}

function css(alto: number) {
  const P = PALETA
  return `
@font-face { font-family: 'Nunito'; src: url('/fuentes/nunito-latin.woff2') format('woff2'); font-weight: 200 1000; font-style: normal; }
@font-face { font-family: 'Nunito'; src: url('/fuentes/nunito-latin-italica.woff2') format('woff2'); font-weight: 200 1000; font-style: italic; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1080px; height: ${alto}px; }
body { background: #fff; font-family: 'Nunito', sans-serif; color: #17251c; position: relative; overflow: hidden; }
.borrador { position: absolute; top: 14px; right: 18px; z-index: 9; background: #7c3aed; color: #fff; font: 800 18px Nunito; padding: 4px 10px; border-radius: 6px; }
.numero { position: absolute; z-index: 9; right: 30px; bottom: ${ALTO.pie + 4}px; font: 900 22px Nunito; color: ${P.verde2}; }
/* encabezado, variante 1 */
.cabeza { position: relative; height: ${ALTO.cabeza['1']}px; }
.hoja { position: absolute; border-radius: 0 100% 0 100%; }
.logo { position: absolute; left: 34px; top: 30px; width: 236px; height: 236px; border-radius: 50%; background: #fff; border: 12px solid ${P.naranja}; box-shadow: 0 0 0 7px #fff, 0 0 0 11px ${P.oliva}; display: grid; place-items: center; z-index: 3; }
.logo img { width: 164px; height: auto; display: block; }
.cinta { position: absolute; left: 196px; right: -20px; top: 40px; height: 140px; background: ${P.verde2}; border-radius: 0 0 0 90px; border-bottom: 10px solid ${P.oliva}; display: flex; align-items: center; padding-left: 96px; z-index: 2; }
.cinta h1, .cinta2 h1 { font: italic 900 92px/1 Nunito; color: #fff; letter-spacing: -1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fecha { position: absolute; left: 330px; top: 176px; z-index: 4; background: ${P.naranja}; color: #fff; border: 6px solid #fff; box-shadow: 0 0 0 3px ${P.naranja}; border-radius: 60px; padding: 10px 40px 10px 28px; display: flex; gap: 18px; align-items: center; font: 900 42px Nunito; white-space: nowrap; }
.fecha svg { width: 42px; height: 42px; }
.rayitas { position: absolute; right: 30px; top: 186px; z-index: 3; transform: rotate(180deg); }
/* encabezado, variante 2 */
.cabeza2 { position: relative; height: ${ALTO.cabeza['2']}px; }
.cinta2 { position: absolute; left: 0; right: 0; top: 0; height: 226px; background: ${P.verde2}; border-bottom: 10px solid ${P.oliva}; border-radius: 0 0 70px 70px; display: flex; align-items: center; gap: 26px; padding: 0 40px; }
.cinta2 img { height: 186px; width: auto; flex: none; }
.cabeza2 .fecha { left: 50%; transform: translateX(-50%); top: 196px; }
/* filas */
.lista { padding: 0 26px; display: grid; gap: ${ALTO.separacion}px; align-content: start; }
.lista > .grupo:first-child { margin-top: ${ALTO.grupoPrimero}px; }
.fila { height: ${ALTO.fila}px; border: 4px solid #9fcb8a; border-radius: 30px; padding: 16px 20px; display: grid; grid-template-columns: 250px minmax(0,1fr) 4px 300px; gap: 20px; align-items: center; background: #fff; }
.caja { background: #ecebee; border-radius: 22px; height: 142px; display: grid; place-items: center; overflow: hidden; }
.caja img { height: 132px; max-width: 94%; object-fit: contain; mix-blend-mode: multiply; }
.sin-foto { font: 800 22px Nunito; color: #888; }
.centro { min-width: 0; }
.nombre { font: 900 36px/1.06 Nunito; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.nombre-corto { -webkit-line-clamp: 2; }
.variantes { margin-top: 8px; display: grid; gap: 2px; font: 700 26px Nunito; color: #2b3a30; }
.variantes span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.variantes span::before { content: ''; display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${P.naranja}; margin-right: 14px; vertical-align: 4px; }
.divisor { width: 4px; height: 82%; background: #17251c; border-radius: 2px; opacity: .85; }
.lado { display: grid; gap: 10px; justify-items: center; min-width: 0; }
.oferta { background: linear-gradient(#1c8b5c, ${P.verde2}); color: #fff; font: italic 900 46px/1 Nunito; padding: 6px 26px; border-radius: 40px 14px 40px 14px; border-bottom: 6px solid ${P.verde}; transform: skewX(-8deg); white-space: nowrap; }
.precio { width: 100%; border: 5px solid ${P.naranja}; border-radius: 26px; overflow: hidden; text-align: center; background: #fff7ec; }
.precio div:first-child { background: ${P.naranja}; color: #fff; font: 900 20px Nunito; letter-spacing: .04em; padding: 1px 0; }
.precio b { display: block; font: 900 44px/1.1 Nunito; color: #17251c; white-space: nowrap; }
.precio b.sin-precio { font-size: 34px; padding: 8px 0; }
.precio small { display: block; font: 800 20px/1 Nunito; margin: -2px 0 6px; }
.oferta-larga { font-size: 38px !important; }
.oferta-muy-larga { font-size: 32px !important; padding-left: 18px !important; padding-right: 18px !important; }
/* grupos */
.grupo { position: relative; border: 4px solid #9fcb8a; border-radius: 30px; padding: 46px 16px 18px; background: #fff; }
.pestana { position: absolute; left: 20px; top: -30px; max-width: 70%; background: ${P.verde2}; color: #fff; font: italic 900 32px Nunito; padding: 4px 28px; border-radius: 30px; border-bottom: 5px solid ${P.verde}; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grupo .oferta { position: absolute; right: 24px; top: -34px; font-size: 44px; padding: 6px 26px; }
.columnas { display: grid; grid-template-columns: repeat(4, 1fr); row-gap: ${ALTO.grupoEntreLineas}px; }
.col { height: ${ALTO.grupoLinea}px; display: grid; grid-template-rows: 124px 1fr auto; align-items: center; justify-items: center; gap: 8px; padding: 0 12px; text-align: center; border-left: 3px solid #17251c; }
.col:nth-child(4n+1) { border-left: 0; }
.col .caja { width: 100%; height: 124px; } .col .caja img { height: 114px; }
.nombre-col { font: 900 25px/1.05 Nunito; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.tam { display: block; font: 800 22px Nunito; text-transform: none; color: #2b3a30; }
.pildora { background: ${P.naranja}; color: #fff; border-radius: 22px; padding: 6px 10px 4px; font: 900 29px/1 Nunito; width: 100%; white-space: nowrap; }
.pildora small { display: block; font: 800 18px Nunito; }
/* uno por producto */
.uno { padding: 6px 50px 0; display: grid; justify-items: center; gap: 22px; text-align: center; }
.caja-grande { width: 620px; height: 560px; border-radius: 40px; border: 5px solid #9fcb8a; }
.caja-grande img { height: 520px; }
.nombre-grande { font: 900 54px/1.05 Nunito; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.fila-precio { display: flex; gap: 30px; align-items: center; }
.fila-precio .precio { width: 430px; } .fila-precio .precio b { font-size: 72px; }
.fila-precio .oferta { font-size: 84px; padding: 18px 40px; }
.precio s { text-decoration-thickness: 3px; }
/* pie con contacto (siempre visible) */
.pie { position: absolute; left: 0; right: 0; bottom: 0; height: ${ALTO.pie}px; background: ${P.verde}; color: #fff; display: flex; align-items: center; justify-content: center; gap: 22px; font: 900 25px Nunito; white-space: nowrap; }
.pie span { display: flex; align-items: center; gap: 10px; } .pie i { color: ${P.naranja}; font-style: normal; }
.pie2 { position: absolute; left: 0; right: 0; bottom: 0; height: ${ALTO.pie}px; background: ${P.verde}; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; }
.pie2 img { height: 66px; width: auto; }
.pie2 .datos { display: grid; gap: 2px; text-align: right; font: 900 24px/1.2 Nunito; }
`
}
