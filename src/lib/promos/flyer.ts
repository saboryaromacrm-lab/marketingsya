// HTML del flyer de promociones (1080 de ancho). Lo abre Chromium para pasarlo a JPEG
// y se ve igual en la vista previa del editor. Paleta de los carruseles aprobados (nunca la del ERP).
// Las alturas salen de ALTO (calculo.ts), así la paginación es exacta. Con pocos productos
// las filas crecen (escalaDePlaca) y los textos largos se achican solos hasta entrar, sin «…».

import { ALTO, altoEscalado, escalaDePlaca, MEDIDAS, POR_LINEA, type Formato } from './calculo'
import { CONTACTO, escaparHtml as e, PALETA } from '@/lib/piezas/html'

export type ItemFlyer = {
  nombre: string
  tam: string | null
  foto: string | null
  precio: string | null // «$ 4.887», «$ 2.611,80» o, en promos del ERP, «3 × $ 2.300»
  unidad: string // «c/u», «el kg», «x250 g» o «» (promo del ERP por cantidad)
  antes: string | null
  desde?: boolean // variantes con precios distintos: se muestra el más bajo con «desde»
}
export type BloqueFlyer =
  | { tipo: 'producto'; nombre: string; tam: string | null; oferta: string; item: ItemFlyer }
  | { tipo: 'variantes'; nombre: string; tam: string | null; oferta: string; variantes: string[]; item: ItemFlyer }
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

// data-ajustar="N": si el texto no entra, se achica de a 1 px hasta N px (ver AJUSTE).
// Con `lineas`, puede ocupar hasta esa cantidad de renglones; sin, va en uno solo.
const aj = (min: number, lineas = 1) => `data-ajustar="${min}"${lineas > 1 ? ` data-lineas="${lineas}"` : ''}`

function caja(item: ItemFlyer, clase = '') {
  return `<div class="caja ${clase}">${item.foto ? `<img src="${e(item.foto)}" alt="">` : '<span class="sin-foto">Sin foto</span>'}</div>`
}

function cuadroPrecio(item: ItemFlyer, conAntes = false) {
  if (!item.precio) return '<div class="precio"><div>PRECIO PROMO</div><b class="sin-precio">Consultar</b></div>'
  const antes = conAntes && item.antes ? `<div class="antes">antes <s>${e(item.antes)}</s></div>` : ''
  return `${antes}<div class="precio"><div>PRECIO PROMO</div><b ${aj(22)}>${item.desde ? '<span class="desde">desde</span>' : ''}${e(item.precio)}</b>${item.unidad ? `<small>${e(item.unidad)}</small>` : ''}</div>`
}

const nombreYMedida = (nombre: string, tam: string | null, clase: string, min: number, lineas: number) =>
  `<div class="${clase}" ${aj(min, lineas)}>${e(nombre)}</div>${tam ? `<div class="medida">${e(tam)}</div>` : ''}`

// «3 × $ 2.300» no entra con la letra de «-10%»: las etiquetas largas empiezan más chicas
const claseOferta = (t: string) => (t.length > 9 ? 'oferta oferta-larga' : 'oferta')

function bloqueHtml(b: BloqueFlyer, k: number): string {
  if (b.tipo === 'grupo') {
    const cols = b.items
      .map((it) => `<div class="col">${caja(it)}<div class="texto-col"><div class="nombre-col" ${aj(16, 3)} data-caja>${e(it.nombre)}</div>${it.tam ? `<span class="tam">${e(it.tam)}</span>` : ''}</div><div class="pildora"><b ${aj(16)}>${it.precio ? e(it.precio) : 'Consultar'}</b>${it.unidad ? `<small>${e(it.unidad)}</small>` : ''}</div></div>`)
      .join('')
    const lineas = Math.ceil(b.items.length / POR_LINEA)
    return `<div class="grupo" style="height:${altoEscalado({ grupo: true, lineas }, k)}px"><div class="pestana" ${aj(20)}>${e(b.titulo)}${b.continuacion ? ' (sigue)' : ''}</div><div class="${claseOferta(b.oferta)}" ${aj(26)}>${e(b.oferta)}</div><div class="columnas">${cols}</div></div>`
  }
  const variantes = b.tipo === 'variantes' && b.variantes.length
    ? `<div class="variantes">${b.variantes.slice(0, 4).map((v) => `<span ${aj(18)}>${e(v)}</span>`).join('')}${b.variantes.length > 4 ? `<span>y ${b.variantes.length - 4} más</span>` : ''}</div>`
    : ''
  return `<div class="fila">${caja(b.item)}<div class="centro">${nombreYMedida(b.nombre, b.tam, 'nombre', 24, variantes ? 2 : 4)}${variantes}</div><div class="divisor"></div><div class="lado"><div class="${claseOferta(b.oferta)}" ${aj(26)}>${e(b.oferta)}</div>${cuadroPrecio(b.item)}</div></div>`
}

function cabeza(d: DatosFlyer) {
  const fecha = `<div class="fecha">${CALENDARIO}${e(d.vigencia)}</div>`
  if (d.diseno === '2') {
    return `<div class="cabeza2"><div class="cinta2"><img src="/marca/circular-blanco.svg" alt="Sabor y Aroma"><h1 ${aj(44)}>${e(d.titulo)}</h1></div>${fecha}</div>`
  }
  return `<div class="cabeza">
    <div class="hoja" style="left:-60px;top:-40px;width:260px;height:150px;background:${PALETA.oliva};transform:rotate(-20deg)"></div>
    <div class="hoja" style="left:-40px;top:70px;width:200px;height:110px;background:${PALETA.verde2};transform:rotate(25deg)"></div>
    <div class="logo"><img src="/marca/circular-verde.svg" alt="Sabor y Aroma"></div>
    <div class="cinta"><h1 ${aj(44)}>${e(d.titulo)}</h1></div>
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
  const nombre = b.tipo === 'grupo' ? `${b.titulo} ${item.nombre}` : b.nombre
  const tam = b.tipo === 'grupo' ? item.tam : b.tam
  // Ocupa todo el alto entre la cabeza y el pie, centrado (sin hueco abajo)
  const alto = MEDIDAS.uno.alto - ALTO.cabeza[d.diseno] - ALTO.pie
  return `<div class="uno" style="height:${alto}px">${caja(item, 'caja-grande')}<div class="texto-grande">${nombreYMedida(nombre, tam, 'nombre-grande', 34, 2)}</div><div class="fila-precio"><div class="${claseOferta(b.oferta)}" ${aj(40)}>${e(b.oferta)}</div><div class="cuadro-uno">${cuadroPrecio(item, true)}</div></div></div>`
}

/** Achica los textos que no entran y avisa al motor que la placa está lista (data-listo). */
const AJUSTE = `<script>(async () => {
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

export function htmlFlyer(d: DatosFlyer): string {
  const { alto } = MEDIDAS[d.formato]
  let cuerpo: string
  if (d.formato === 'uno') cuerpo = uno(d)
  else {
    const medidas = d.bloques.map((b) => ({ grupo: b.tipo === 'grupo', lineas: b.tipo === 'grupo' ? Math.ceil(b.items.length / POR_LINEA) : 1 }))
    const { k, arriba, entre } = escalaDePlaca(medidas, d.formato, d.diseno)
    // Los textos crecen menos que las fotos, para que nada quede apretado
    const kt = Math.min(k, 1.3)
    const kn = Math.min(k, 1.15) // nombre y columna del precio: crecen poco, así el nombre tiene lugar
    const vars = `--k:${k};--kt:${kt};--kn:${kn};--alto-fila:${altoEscalado({ grupo: false, lineas: 1 }, k)}px;--alto-linea:${Math.round(ALTO.grupoLinea * k)}px`
    cuerpo = `<div class="lista" style="${vars};padding-top:${arriba}px;gap:${entre}px">${d.bloques.map((b) => bloqueHtml(b, k)).join('')}</div>`
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="pieza-tamano" content="1080x${alto}"><title>Promo</title><style>${css(alto)}</style></head><body class="d${d.diseno}">
${d.borrador ? '<span class="borrador">VISTA PREVIA</span>' : ''}${d.paginas > 1 ? `<span class="numero">${d.pagina}/${d.paginas}</span>` : ''}
${cabeza(d)}${cuerpo}${pie(d)}${AJUSTE}</body></html>`
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
.cinta { position: absolute; left: 196px; right: -20px; top: 40px; height: 140px; background: ${P.verde2}; border-radius: 0 0 0 90px; border-bottom: 10px solid ${P.oliva}; display: flex; align-items: center; padding: 0 50px 0 96px; z-index: 2; }
.cinta h1, .cinta2 h1 { flex: 1; min-width: 0; font: italic 900 92px/1.15 Nunito; color: #fff; letter-spacing: -1px; white-space: nowrap; overflow: hidden; }
.fecha { position: absolute; left: 330px; top: 176px; z-index: 4; background: ${P.naranja}; color: #fff; border: 6px solid #fff; box-shadow: 0 0 0 3px ${P.naranja}; border-radius: 60px; padding: 10px 40px 10px 28px; display: flex; gap: 18px; align-items: center; font: 900 42px Nunito; white-space: nowrap; }
.fecha svg { width: 42px; height: 42px; }
.rayitas { position: absolute; right: 30px; top: 186px; z-index: 3; transform: rotate(180deg); }
/* encabezado, variante 2 */
.cabeza2 { position: relative; height: ${ALTO.cabeza['2']}px; }
.cinta2 { position: absolute; left: 0; right: 0; top: 0; height: 226px; background: ${P.verde2}; border-bottom: 10px solid ${P.oliva}; border-radius: 0 0 70px 70px; display: flex; align-items: center; gap: 26px; padding: 0 40px; }
.cinta2 img { height: 186px; width: auto; flex: none; }
.cabeza2 .fecha { left: 50%; transform: translateX(-50%); top: 196px; }
/* filas: crecen con --k cuando sobra lugar */
.lista { padding: 0 26px; display: grid; gap: ${ALTO.separacion}px; align-content: start; }
.lista > .grupo:first-child { margin-top: ${ALTO.grupoPrimero}px; }
.fila { height: var(--alto-fila); border: 4px solid #9fcb8a; border-radius: 30px; padding: 16px 20px; display: grid; grid-template-columns: calc(250px * var(--kt)) minmax(0,1fr) 4px calc(300px * var(--kn)); gap: 20px; align-items: center; background: #fff; }
.caja { background: #ecebee; border-radius: 22px; height: calc(var(--alto-fila) - 50px); display: grid; place-items: center; overflow: hidden; }
.caja img { height: 93%; max-width: 94%; object-fit: contain; mix-blend-mode: multiply; }
.sin-foto { font: 800 22px Nunito; color: #888; }
.centro { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
.nombre { font: 900 calc(38px * var(--kn))/1.06 Nunito; text-transform: uppercase; }
.medida { font: 800 calc(26px * var(--kt)) Nunito; color: #2b3a30; }
.variantes { margin-top: 4px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; font: 700 calc(24px * var(--kt)) Nunito; color: #2b3a30; }
.variantes span { white-space: nowrap; overflow: hidden; display: block; }
.variantes span::before { content: ''; display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${P.naranja}; margin-right: 12px; vertical-align: 3px; }
.divisor { width: 4px; height: 82%; background: #17251c; border-radius: 2px; opacity: .85; }
.lado { display: grid; gap: 10px; justify-items: center; min-width: 0; }
.oferta { max-width: 100%; overflow: hidden; background: linear-gradient(#1c8b5c, ${P.verde2}); color: #fff; font: italic 900 calc(46px * var(--kt, 1))/1.1 Nunito; padding: 4px 26px; border-radius: 40px 14px 40px 14px; border-bottom: 6px solid ${P.verde}; transform: skewX(-8deg); white-space: nowrap; }
.oferta-larga { font-size: calc(36px * var(--kt, 1)); }
.precio { width: 100%; border: 5px solid ${P.naranja}; border-radius: 26px; overflow: hidden; text-align: center; background: #fff7ec; }
.precio div:first-child { background: ${P.naranja}; color: #fff; font: 900 calc(20px * var(--kt, 1)) Nunito; letter-spacing: .04em; padding: 1px 0; }
.precio b { display: block; padding: 0 8px; font: 900 calc(44px * var(--kt, 1))/1.12 Nunito; color: #17251c; white-space: nowrap; overflow: hidden; }
.precio b.sin-precio { font-size: 34px; padding: 8px 0; }
.precio small { display: block; font: 800 calc(20px * var(--kt, 1))/1 Nunito; margin: -2px 0 6px; }
.desde { font-size: .5em; font-weight: 800; margin-right: 6px; vertical-align: .3em; text-transform: uppercase; }
.antes { font: 800 30px Nunito; color: #555; }
.antes s { text-decoration-thickness: 3px; }
/* grupos */
.grupo { position: relative; border: 4px solid #9fcb8a; border-radius: 30px; padding: 46px 16px 14px; background: #fff; }
.pestana { position: absolute; left: 20px; top: -30px; max-width: 64%; background: ${P.verde2}; color: #fff; font: italic 900 32px/1.2 Nunito; padding: 4px 28px; border-radius: 30px; border-bottom: 5px solid ${P.verde}; text-transform: uppercase; white-space: nowrap; overflow: hidden; }
.grupo .oferta { position: absolute; right: 24px; top: -34px; max-width: 34%; font-size: 44px; padding: 4px 26px; }
.grupo .oferta-larga { font-size: 34px; }
.columnas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); row-gap: ${ALTO.grupoEntreLineas}px; }
.col { height: var(--alto-linea); min-width: 0; display: grid; grid-template-rows: calc(124px * var(--k)) minmax(0, 1fr) auto; align-items: center; justify-items: center; gap: 8px; padding: 0 12px; text-align: center; border-left: 3px solid #17251c; }
.col:nth-child(4n+1) { border-left: 0; }
.col .caja { width: 100%; height: calc(124px * var(--k)); } .col .caja img { height: 92%; }
.texto-col { min-width: 0; width: 100%; align-self: stretch; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
.nombre-col { font: 900 calc(25px * var(--kt))/1.05 Nunito; text-transform: uppercase; }
.tam { display: block; font: 800 calc(21px * var(--kt)) Nunito; text-transform: none; color: #2b3a30; }
.pildora { background: ${P.naranja}; color: #fff; border-radius: 22px; padding: 6px 8px 4px; width: 100%; min-width: 0; }
.pildora b { display: block; font: 900 calc(29px * var(--kt))/1 Nunito; white-space: nowrap; overflow: hidden; }
.pildora small { display: block; font: 800 calc(17px * var(--kt)) Nunito; }
/* uno por producto */
.uno { padding: 0 50px 10px; display: grid; justify-items: center; align-content: center; gap: 18px; text-align: center; }
.caja-grande { width: 620px; height: 540px; border-radius: 40px; border: 5px solid #9fcb8a; }
.texto-grande { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
.nombre-grande { font: 900 54px/1.05 Nunito; text-transform: uppercase; }
.texto-grande .medida { font-size: 34px; }
.fila-precio { display: flex; gap: 30px; align-items: center; max-width: 100%; }
.fila-precio .oferta { font-size: 76px; padding: 14px 36px; max-width: 46%; }
.fila-precio .oferta-larga { font-size: 56px; }
.cuadro-uno { width: 440px; display: grid; gap: 6px; justify-items: center; }
.cuadro-uno .precio b { font-size: 66px; }
.cuadro-uno .precio small { font-size: 24px; }
/* pie con contacto (siempre visible) */
.pie { position: absolute; left: 0; right: 0; bottom: 0; height: ${ALTO.pie}px; background: ${P.verde}; color: #fff; display: flex; align-items: center; justify-content: center; gap: 22px; font: 900 25px Nunito; white-space: nowrap; }
.pie span { display: flex; align-items: center; gap: 10px; } .pie i { color: ${P.naranja}; font-style: normal; }
.pie2 { position: absolute; left: 0; right: 0; bottom: 0; height: ${ALTO.pie}px; background: ${P.verde}; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; }
.pie2 img { height: 66px; width: auto; }
.pie2 .datos { display: grid; gap: 2px; text-align: right; font: 900 24px/1.2 Nunito; }
`
}
