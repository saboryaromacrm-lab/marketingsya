// Textos que se arman solos a partir del catálogo. Funciones puras: se usan en el servidor
// (placas) y en el editor (sugerencias), y se prueban sin base ni navegador.

import { separarMedida } from '@/lib/promos/calculo'

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Títulos con renglones marcados por «/»: «Pasta de / maní natural» → ['Pasta de', 'maní natural']. */
export const renglones = (t: string | null | undefined, max = 4) =>
  String(t ?? '').split('/').map((x) => x.trim()).filter(Boolean).slice(0, max)

/** El texto sin las barras, para el posteo o para mostrar en una línea. */
export const enUnaLinea = (t: string | null | undefined) => renglones(t, 9).join(' ')

/** Saca la marca del nombre («Pasta de Maní Natural Entrenuts» → «Pasta de Maní Natural»). */
export function sinMarca(nombre: string, marca: string | null | undefined): string {
  if (!marca) return nombre.trim()
  const m = sinTildes(marca).split(/\s+/).filter(Boolean)
  const palabras = nombre.split(/\s+/).filter(Boolean)
  // Saca la secuencia de palabras de la marca donde aparezca entera
  for (let i = 0; i + m.length <= palabras.length; i++) {
    if (m.every((w, k) => sinTildes(palabras[i + k]) === w)) {
      return [...palabras.slice(0, i), ...palabras.slice(i + m.length)].join(' ').trim() || nombre.trim()
    }
  }
  return nombre.trim()
}

/** Minúscula como en los carruseles aprobados («Pasta de maní natural»), sin tocar siglas (MCT) ni la primera palabra. */
export function comoOracion(t: string): string {
  return t
    .split(/\s+/)
    .map((w, i) => (i > 0 && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+$/.test(w) ? w.toLowerCase() : w))
    .join(' ')
}

/** Parte un nombre en 2 renglones parejos (o 1 si es corto). */
export function partirEnDos(t: string): string {
  const p = t.split(/\s+/).filter(Boolean)
  if (p.length < 2 || t.length <= 11) return t
  let mejor = 1
  let dif = Infinity
  for (let i = 1; i < p.length; i++) {
    const a = p.slice(0, i).join(' ').length
    const b = p.slice(i).join(' ').length
    if (Math.abs(a - b) < dif) { dif = Math.abs(a - b); mejor = i }
  }
  return `${p.slice(0, mejor).join(' ')} / ${p.slice(mejor).join(' ')}`
}

export type ProductoTexto = { nombre: string; marca?: string | null; granel?: boolean; categoria?: string | null; presentaciones?: { tamano: string; kg: number | null }[] }

/** Nombre grande de la placa: sin medida ni marca, en minúscula de oración y en 2 renglones. */
export function nombreEnPlaca(p: ProductoTexto): string {
  return partirEnDos(comoOracion(sinMarca(separarMedida(p.nombre).nombre, p.marca)))
}

/** Nombre corto en una línea («Pasta de maní natural»), para ingredientes y «por qué te hace bien». */
export const nombreCorto = (p: ProductoTexto) => comoOracion(sinMarca(separarMedida(p.nombre).nombre, p.marca))

/** Línea chica debajo del nombre: «Entrenuts · 370 g» o «A granel · 90 g, 250 g y 1 kg». */
export function lineaChica(p: ProductoTexto): string {
  if (p.granel) {
    const tams = [...(p.presentaciones ?? [])].sort((a, b) => (a.kg ?? 0) - (b.kg ?? 0)).map((x) => x.tamano)
    if (!tams.length) return 'A granel'
    const lista = tams.length > 1 ? `${tams.slice(0, -1).join(', ')} y ${tams[tams.length - 1]}` : tams[0]
    return `A granel · ${lista}`
  }
  const tam = separarMedida(p.nombre).tam?.replace(/^x/, '') ?? null
  return [p.marca ? comoOracion(p.marca.charAt(0) + p.marca.slice(1).toLowerCase()) : null, tam].filter(Boolean).join(' · ')
}

/** Etiqueta washi del estilo Lanzamiento, a partir de la categoría: «Frutos Secos y Semillas» → «frutos secos». */
export function etiquetaDeCategoria(categoria: string | null | undefined): string {
  if (!categoria) return 'natural'
  return categoria.split(/,| y /i)[0].trim().toLowerCase()
}

// Frase sugerida por categoría (se reemplaza por la que escriba Lucas, que queda guardada en el producto)
const FRASES: [RegExp, string][] = [
  [/frutos secos|semillas/, 'Para picar, para la granola o para cocinar.'],
  [/cereal|grano|legumbre/, 'Para tus desayunos y comidas de todos los días.'],
  [/untable|dulce/, 'Ideal para tus desayunos y meriendas.'],
  [/l[aá]cteo/, 'Rico, fresco y para toda la familia.'],
  [/endulzante/, 'Endulzá sin culpa.'],
  [/suplemento/, 'Un aliado natural para tu día.'],
  [/bebida|infusi|yerba|t[eé]/, 'Para acompañar cada momento.'],
  [/harina|panific|galleti/, 'Para cocinar rico y sano.'],
  [/aceite|condimento|especia/, 'El toque natural para tus comidas.'],
]
export function fraseSugerida(categoria: string | null | undefined): string {
  const c = sinTildes(categoria ?? '')
  return FRASES.find(([re]) => re.test(c))?.[1] ?? 'Lo que hace bien, conviene.'
}

/** Texto del ingrediente en Recetas: «de avena instantánea». */
export const textoIngrediente = (p: ProductoTexto) => `de ${nombreCorto(p).toLowerCase()}`

// ---------------------------------------------------------------------------
// Texto del posteo (lo que va debajo del carrusel en Instagram)
// ---------------------------------------------------------------------------
export type ContactoTexto = { web: string; whatsapp: string; instagram: string }
const cierre = (k: ContactoTexto) => `🛒 ${k.web} · Sin mínimo de compra\n📲 WhatsApp ${k.whatsapp} · ${k.instagram}`

const enumerar = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] ?? '')

export function textoPosteo(estilo: 'lanzamiento' | 'nutriofertas' | 'recetas' | 'promo', d: { titulo: string; bajada?: string; productos: string[]; contacto: ContactoTexto; hashtags?: string[] }): string {
  const CIERRE = cierre(d.contacto)
  const tags = (extra: string) => [...(d.hashtags ?? ['#SaborYAroma', '#Formosa', '#VidaSana']), extra].join(' ')
  if (estilo === 'promo') {
    return `🧡 ${d.titulo} en Sabor y Aroma${d.bajada ? ` · ${d.bajada}` : ''}${d.productos.length ? `\n${enumerar(d.productos.map((x) => x.toLowerCase()))}.` : ''}\n${CIERRE}\n${tags('#Promociones')}`
  }
  const productos = enumerar(d.productos.map((x) => x.toLowerCase()))
  if (estilo === 'nutriofertas') {
    return `🧡 NutriOfertas de la semana en Sabor y Aroma${productos ? `: ${productos}` : ''}, a precios bajos que nutren.\n${CIERRE}\n${tags('#NutriOfertas')}`
  }
  if (estilo === 'recetas') {
    return `🥣 ${d.titulo}${d.bajada ? ` · ${d.bajada}` : ''}\n${productos ? `Ingredientes: ${productos}. ` : ''}Conseguí todo en un solo lugar.\n${CIERRE}\n${tags('#RecetasSaludables')}`
  }
  return `🌿 ${d.titulo}${d.bajada ? `\n${d.bajada}` : ''}${productos ? `\n${productos.charAt(0).toUpperCase()}${productos.slice(1)} y mucho más.` : ''}\n${CIERRE}\n${tags('#Dietética')}`
}
