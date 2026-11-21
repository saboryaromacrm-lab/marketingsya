import 'server-only'
import { cargarCarrusel, precioNutri, type CarruselCargado } from '@/lib/carruseles/datos'
import { etiquetaDeCategoria, fraseSugerida, lineaChica, nombreCorto, nombreEnPlaca, renglones, textoIngrediente } from '@/lib/carruseles/textos'
import type { DatosLanzamiento, DatosNutriofertas, DatosRecetas } from '@/lib/carruseles/tipos'
import { bloque, cargarPromo, type PromoCargada } from '@/lib/promos/datos'
import { textoVigencia } from '@/lib/promos/fechas'
import { partirEnDos } from '@/lib/carruseles/textos'
import { qrDataUri } from '@/lib/piezas/qr'
import { huellaDe } from '@/lib/piezas/huella'
import { leerConfig } from '@/lib/configuracion'
import { ANIMACION_INICIAL, FORMATOS_VIDEO, limpiarAnimacion, type FormatoVideo } from './tipos'
import { htmlVideo, type EscenaVideo, type TemaVideo } from './escenas'

// Las escenas de cada video salen del mismo contenido de la pieza (textos, productos y precios del catálogo).

const lineas = (t: string) => renglones(t)
const partir = (t: string) => renglones(partirEnDos(t))

function escenasCarrusel(c: CarruselCargado): EscenaVideo[] {
  const p = (id: number | null) => (id != null ? c.productos.get(id) : undefined)
  const cierre = (titulo: string, bajada: string | null): EscenaVideo => ({ tipo: 'cierre', titulo: lineas(titulo), bajada })
  if (c.carrusel.estilo === 'nutriofertas') {
    const d = c.datos as DatosNutriofertas
    return [
      { tipo: 'portada', titulo: lineas(d.portada.titulo), sub: d.portada.bajada, destacado: d.portada.destacado, texto: d.portada.texto, sello: d.portada.sello, boton: d.portada.boton, fotos: [] },
      ...d.productos.filter((it) => p(it.id)).map((it): EscenaVideo => {
        const prod = p(it.id)!
        const precio = precioNutri(prod, it, c.carrusel.listaId)
        return {
          tipo: 'producto', etiqueta: 'NutriOferta', nombre: lineas(it.nombre || nombreEnPlaca(prod)), linea: it.linea || lineaChica(prod),
          precio: precio ? { texto: precio.texto, unidad: precio.unidad === 'c/u' ? '' : precio.unidad, antes: precio.antes } : null,
          frase: it.frase || prod.frase || fraseSugerida(prod.categoria), foto: prod.foto, granel: prod.granel, sello: precio?.antes ? 'Oferta' : null,
        }
      }),
      cierre(d.cierre.titulo, d.cierre.bajada),
    ]
  }
  if (c.carrusel.estilo === 'recetas') {
    const d = c.datos as DatosRecetas
    const ingredientes = d.ingredientes.items.filter((it) => p(it.id))
    return [
      { tipo: 'portada', titulo: lineas(d.portada.titulo), sub: d.portada.bajada, destacado: d.portada.destacado, texto: d.portada.texto, sello: d.portada.sello, boton: d.portada.boton, fotos: [p(d.portada.producto)?.foto ?? null] },
      ...(ingredientes.length ? [{ tipo: 'lista' as const, titulo: lineas(d.ingredientes.titulo), bajada: d.ingredientes.bajada, items: ingredientes.map((it) => ({ foto: p(it.id)!.foto, texto: `${it.cantidad} ${it.texto || textoIngrediente(p(it.id)!)}`.trim(), detalle: null })) }] : []),
      ...(d.preparacion.pasos.some((x) => x.trim()) ? [{ tipo: 'pasos' as const, titulo: lineas(d.preparacion.titulo), pasos: d.preparacion.pasos.filter((x) => x.trim()), foto: p(d.preparacion.foto)?.foto ?? null }] : []),
      cierre(d.cierre.titulo, d.cierre.bajada),
    ]
  }
  const d = c.datos as DatosLanzamiento
  return [
    { tipo: 'portada', kicker: d.portada.kicker, titulo: lineas(d.portada.titulo), boton: d.portada.pastilla, texto: d.portada.pie, fotos: d.portada.productos.map((id) => p(id)?.foto ?? null) },
    ...d.productos.items.filter((it) => p(it.id)).map((it): EscenaVideo => {
      const prod = p(it.id)!
      return { tipo: 'producto', etiqueta: it.etiqueta || etiquetaDeCategoria(prod.categoria), nombre: partir(nombreCorto(prod)), linea: lineaChica(prod), precio: null, frase: prod.frase || fraseSugerida(prod.categoria), foto: prod.foto, granel: prod.granel }
    }),
    cierre(d.cierre.titulo, d.cierre.pie),
  ]
}

function escenasPromo(d: PromoCargada): EscenaVideo[] {
  const fotos = [...d.productos.values()].map((p) => p.foto).filter(Boolean).slice(0, 3)
  const filas = d.filas.map((f, i): EscenaVideo => {
    const b = bloque(d, i, 0, f.productos.length)
    if (b.tipo === 'grupo') {
      return { tipo: 'lista', titulo: lineas(b.titulo), oferta: b.oferta, items: b.items.map((it) => ({ foto: it.foto, texto: it.nombre, detalle: it.tam, precio: it.precio ? `${it.precio}${it.unidad ? ` ${it.unidad}` : ''}` : null })) }
    }
    const it = b.item
    return {
      tipo: 'producto', etiqueta: 'Promo', nombre: partir(b.nombre), linea: b.tipo === 'variantes' ? `${b.tam ? `${b.tam} · ` : ''}${b.variantes.length} sabores` : b.tam,
      precio: it.precio ? { texto: `${it.desde ? 'desde ' : ''}${it.precio}`, unidad: it.unidad, antes: it.antes } : null,
      frase: b.tipo === 'variantes' ? b.variantes.slice(0, 4).join(', ') : null, foto: it.foto, oferta: b.oferta,
    }
  })
  return [
    { tipo: 'portada', titulo: [d.promo.titulo || 'PROMOCIONES'], vigencia: textoVigencia(d.promo.desde, d.promo.hasta), fotos, texto: 'Precios especiales en Sabor y Aroma', boton: 'Ver promos →' },
    ...filas,
    { tipo: 'cierre', titulo: ['¡Aprovechalas!'], bajada: `${textoVigencia(d.promo.desde, d.promo.hasta).toLowerCase()} · sin mínimo de compra` },
  ]
}

export type VideoArmado = { html: string; total: number; omitidas: number; huella: string; musicaId: number | null; portada: number; ancho: number; alto: number }

/** El HTML del video de una pieza en un formato (vista: se reproduce solo en la pantalla). */
export async function videoDe(tipo: 'carrusel' | 'promo', id: number, formato: FormatoVideo, vista = false): Promise<VideoArmado | null> {
  const config = await leerConfig()
  const fv = FORMATOS_VIDEO[formato]
  let tema: TemaVideo, escenas: EscenaVideo[], semilla: number, anim
  if (tipo === 'carrusel') {
    const c = await cargarCarrusel(id)
    if (!c) return null
    tema = c.carrusel.estilo
    escenas = escenasCarrusel(c)
    semilla = c.carrusel.id * 7919
    anim = limpiarAnimacion(c.carrusel.animacion ?? ANIMACION_INICIAL, { ...ANIMACION_INICIAL, ...config.creacion.animacion })
  } else {
    const d = await cargarPromo(id)
    if (!d) return null
    tema = 'promo'
    escenas = escenasPromo(d)
    semilla = d.promo.id * 7919
    anim = limpiarAnimacion(d.promo.animacion ?? ANIMACION_INICIAL, { ...ANIMACION_INICIAL, ...config.creacion.animacion })
  }
  // La historia en video es más corta: su duración es la menor entre la elegida y la de su formato
  const maximo = formato === 'historiaVideo' ? Math.min(anim.duracion, fv.duracion) : anim.duracion
  const r = htmlVideo({ tema, escenas, ancho: fv.ancho, alto: fv.alto, maximo, ritmo: anim.ritmo, variante: anim.variante, semilla, contacto: config.contacto, qr: qrDataUri(`https://${config.contacto.web}`), vista })
  const sinReloj = vista ? htmlVideo({ tema, escenas, ancho: fv.ancho, alto: fv.alto, maximo, ritmo: anim.ritmo, variante: anim.variante, semilla, contacto: config.contacto, qr: qrDataUri(`https://${config.contacto.web}`), vista: false }).html : r.html
  return { html: r.html, total: r.total, omitidas: r.omitidas, huella: huellaDe([sinReloj, String(anim.musicaId ?? ''), String(anim.portada)]), musicaId: anim.musicaId, portada: Math.min(anim.portada, Math.max(0, r.total - 0.1)), ancho: fv.ancho, alto: fv.alto }
}
