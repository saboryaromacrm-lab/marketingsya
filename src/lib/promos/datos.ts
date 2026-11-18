import 'server-only'
import { asc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { urlMedia } from '@/lib/media'
import type { ItemFila, TipoFila } from '@/lib/db/esquema'
import type { ProductoNormalizado } from '@/lib/catalogo/tipos'
import { nombresCortos, paginar, pesosPromo, precioBase, precioPromo, separarMedida, textoOferta, tituloComun, type Formato } from './calculo'
import { textoVigencia } from './fechas'
import type { BloqueFlyer, DatosFlyer, ItemFlyer } from './flyer'

const { promos, promoFilas, productos, listas } = esquema

export type FilaPromo = typeof promoFilas.$inferSelect
export type ProductoPromo = { id: number; nombre: string; foto: string | null; erp: ProductoNormalizado; tipo: string; dadoDeBaja: boolean }

export async function cargarPromo(id: number) {
  const [promo] = await db.select().from(promos).where(eq(promos.id, id))
  if (!promo) return null
  const filas = await db.select().from(promoFilas).where(eq(promoFilas.promoId, id)).orderBy(asc(promoFilas.orden))
  const ids = [...new Set(filas.flatMap((f) => f.productos.map((p) => p.id)))]
  const prods = ids.length
    ? await db
        .select({ id: productos.id, nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`, foto: fotoEfectiva, erp: productos.erp, tipo: productos.tipo, dadoDeBaja: productos.dadoDeBaja })
        .from(productos)
        .where(inArray(productos.id, ids))
    : []
  return { promo, filas, productos: new Map<number, ProductoPromo>(prods.map((p) => [p.id, { ...p, foto: p.foto ? urlMedia(p.foto) : null }])) }
}
export type PromoCargada = NonNullable<Awaited<ReturnType<typeof cargarPromo>>>

/** Precio base y promo de un producto dentro de una fila. */
export function preciosDe(p: ProductoPromo | undefined, item: ItemFila, fila: Pick<FilaPromo, 'descuento' | 'cantidadMinima' | 'precioFijo'>, listaId: number) {
  const base = p ? precioBase(p.erp, listaId, item.presentacion) : null
  return { base, promo: precioPromo(base, fila) }
}

function itemFlyer(p: ProductoPromo | undefined, item: ItemFila, fila: FilaPromo, listaId: number, corto: { nombre: string; tam: string | null }): ItemFlyer {
  const { base, promo } = preciosDe(p, item, fila, listaId)
  return {
    nombre: item.nombre || corto.nombre,
    tam: item.tam ?? corto.tam,
    foto: p?.foto ?? null,
    precio: promo != null ? pesosPromo(promo) : null,
    antes: base != null && promo != null && promo < base ? pesosPromo(base) : null,
  }
}

/** Cada fila de la promo pasada a lo que dibuja el flyer (los productos [desde, hasta)). */
function bloque(d: PromoCargada, i: number, desde: number, hasta: number): BloqueFlyer {
  const fila = d.filas[i]
  const lista = d.promo.listaId
  const prods = fila.productos.map((it) => d.productos.get(it.id))
  const nombres = prods.map((p) => p?.nombre ?? 'Producto')
  const cortos = nombresCortos(nombres)
  const oferta = textoOferta(fila)
  const items = fila.productos.map((it, k) => itemFlyer(prods[k], it, fila, lista, cortos[k]))
  if (fila.tipo === 'grupo') {
    return { tipo: 'grupo', titulo: fila.titulo || tituloComun(nombres) || 'Promo', oferta, items: items.slice(desde, hasta), continuacion: desde > 0 }
  }
  if (fila.tipo === 'variantes') {
    const medidas = new Set(cortos.map((c) => c.tam))
    const medida = medidas.size === 1 ? [...medidas][0] : null
    const titulo = fila.titulo || [tituloComun(nombres), medida].filter(Boolean).join(' ')
    return { tipo: 'variantes', nombre: titulo, oferta, variantes: items.map((it) => it.nombre), item: items[0] }
  }
  return { tipo: 'producto', nombre: fila.titulo || nombres[0], oferta, item: { ...items[0], tam: null } }
}

export type Placa = { formato: Formato; pagina: number; paginas: number; datos: DatosFlyer }

/** Todas las placas que salen de la promo, en orden: historias, feed y uno por producto. */
export function planDePlacas(d: PromoCargada): Placa[] {
  const { promo, filas } = d
  const base = { titulo: promo.titulo, vigencia: textoVigencia(promo.desde, promo.hasta), diseno: promo.diseno }
  const placas: Placa[] = []
  for (const formato of ['historia', 'feed'] as const) {
    if (!promo.formatos[formato]) continue
    const paginas = paginar(filas, formato, promo.diseno)
    paginas.forEach((bloques, n) =>
      placas.push({ formato, pagina: n + 1, paginas: paginas.length, datos: { ...base, formato, pagina: n + 1, paginas: paginas.length, bloques: bloques.map((b) => bloque(d, b.fila, b.desde, b.hasta)) } }),
    )
  }
  if (promo.formatos.uno) {
    const unos = filas.flatMap((f, i) => f.productos.map((_, k) => ({ i, k })))
    unos.forEach(({ i, k }, n) => {
      const b = bloque(d, i, 0, d.filas[i].productos.length)
      // En «uno por producto» cada producto va solo, con su nombre completo
      const p = d.productos.get(d.filas[i].productos[k].id)
      const item = b.tipo === 'grupo' ? b.items[k] : itemFlyer(p, d.filas[i].productos[k], d.filas[i], promo.listaId, separarMedida(p?.nombre ?? ''))
      const nombre = d.filas[i].tipo === 'producto' ? (d.filas[i].titulo || p?.nombre || '') : (p?.nombre ?? '')
      placas.push({ formato: 'uno', pagina: n + 1, paginas: unos.length, datos: { ...base, formato: 'uno', pagina: n + 1, paginas: unos.length, bloques: [{ tipo: 'producto', nombre, oferta: b.oferta, item }] } })
    })
  }
  return placas
}

export const rutaPlaca = (promoId: number, p: Pick<Placa, 'formato' | 'pagina'>) => `/render/promo/${promoId}?formato=${p.formato}&pagina=${p.pagina}`

/**
 * Promos cargadas en el ERP (lista «Promo»): se suman solas a cada promo nueva.
 * La lista se busca por nombre, no por número, por si cambia en el ERP.
 */
export async function filasDelErp(): Promise<{ tipo: TipoFila; precioFijo: number; cantidadMinima: number | null; productos: ItemFila[] }[]> {
  const [lista] = await db.select({ id: listas.id }).from(listas).where(ilike(listas.nombre, 'promo%')).limit(1)
  if (!lista) return []
  const filas = await db
    .select({ id: productos.id, precios: productos.preciosLista })
    .from(productos)
    .where(sql`not ${productos.dadoDeBaja} and not ${productos.excluirDePiezas} and ${productos.preciosLista} ? ${String(lista.id)}`)
  return filas.map((f) => {
    const x = f.precios[String(lista.id)]
    return { tipo: 'producto' as const, precioFijo: x.precio, cantidadMinima: x.unidades > 1 ? x.unidades : null, productos: [{ id: f.id, presentacion: x.presentacion }] }
  })
}
