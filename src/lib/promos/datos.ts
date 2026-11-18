import 'server-only'
import { asc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { urlMedia } from '@/lib/media'
import type { ItemFila, TipoFila } from '@/lib/db/esquema'
import type { ProductoNormalizado } from '@/lib/catalogo/tipos'
import { detalleBase, nombresCortos, paginar, pesosPromo, precioBase, precioPromo, separarMedida, textoOferta, textoPrecioErp, tituloComun, type Formato } from './calculo'
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

/** Un producto como lo dibuja el flyer: precio promo con su unidad («c/u», «el kg», «x250 g»). */
function itemFlyer(p: ProductoPromo | undefined, item: ItemFila, fila: FilaPromo, listaId: number, corto: { nombre: string; tam: string | null }): ItemFlyer {
  const det = p ? detalleBase(p.erp, p.tipo === 'granel', listaId, item.presentacion) : null
  const base = det?.precio ?? null
  const promo = precioPromo(base, fila)
  const comun = { nombre: item.nombre || corto.nombre, tam: item.tam ?? corto.tam, foto: p?.foto ?? null }
  // Promo del ERP por cantidad: un solo precio, entero y claro («3 × $ 2.300»)
  if (fila.precioFijo != null && fila.cantidadMinima && fila.cantidadMinima > 1) {
    const n = fila.cantidadMinima
    return { ...comun, precio: textoPrecioErp(fila.precioFijo, n), unidad: '', antes: base != null && base * n > fila.precioFijo * n ? textoPrecioErp(base, n) : null }
  }
  return {
    ...comun,
    precio: promo != null ? pesosPromo(promo) : null,
    unidad: det?.unidad ?? 'c/u',
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
    const t = separarMedida(fila.titulo || tituloComun(nombres))
    // Si los sabores cuestan distinto, va el más barato con «desde» (nunca un precio que no corresponde)
    const conPrecio = fila.productos.map((it, k) => ({ k, v: precioPromo(preciosDe(prods[k], it, fila, lista).base, fila) })).filter((x) => x.v != null)
    const menor = conPrecio.sort((a, b) => a.v! - b.v!)[0]
    const distintos = new Set(conPrecio.map((x) => x.v)).size > 1
    const item = menor ? { ...items[menor.k], desde: distintos } : items[0]
    return { tipo: 'variantes', nombre: t.nombre, tam: t.tam ?? medida, oferta, variantes: items.map((it) => it.nombre), item }
  }
  const t = separarMedida(fila.titulo || nombres[0])
  return { tipo: 'producto', nombre: t.nombre, tam: t.tam, oferta, item: items[0] }
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
      const t = separarMedida(d.filas[i].tipo === 'producto' ? (d.filas[i].titulo || p?.nombre || '') : (p?.nombre ?? ''))
      placas.push({ formato: 'uno', pagina: n + 1, paginas: unos.length, datos: { ...base, formato: 'uno', pagina: n + 1, paginas: unos.length, bloques: [{ tipo: 'producto', nombre: t.nombre, tam: t.tam, oferta: b.oferta, item: { ...item, desde: false } }] } })
    })
  }
  return placas
}

export const rutaPlaca = (promoId: number, p: Pick<Placa, 'formato' | 'pagina'>) => `/render/promo/${promoId}?formato=${p.formato}&pagina=${p.pagina}`

/**
 * Promos cargadas en el ERP (lista «Promo»): se suman solas a cada promo nueva.
 * La lista se busca por nombre, no por número, por si cambia en el ERP.
 */
async function productosDeListaPromo() {
  const [lista] = await db.select({ id: listas.id }).from(listas).where(ilike(listas.nombre, 'promo%')).limit(1)
  if (!lista) return { lista: null, filas: [] }
  const filas = await db
    .select({ id: productos.id, nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`, precios: productos.preciosLista, foto: fotoEfectiva })
    .from(productos)
    .where(sql`not ${productos.dadoDeBaja} and not ${productos.excluirDePiezas} and ${productos.preciosLista} ? ${String(lista.id)}`)
  return { lista, filas }
}

/** Promos del ERP que no se pueden sumar porque el producto no tiene foto (para avisar en el editor). */
export async function erpSinFoto(): Promise<{ id: number; nombre: string }[]> {
  const { filas } = await productosDeListaPromo()
  return filas.filter((f) => !f.foto).map((f) => ({ id: f.id, nombre: f.nombre }))
}

export async function filasDelErp(): Promise<{ tipo: TipoFila; precioFijo: number; cantidadMinima: number | null; productos: ItemFila[] }[]> {
  const { lista, filas: todas } = await productosDeListaPromo()
  if (!lista) return []
  // Sin foto no se suma (una placa con «Sin foto» no sale): se avisa en el editor con erpSinFoto()
  const filas = todas.filter((f) => f.foto)
  return filas.map((f) => {
    const x = f.precios[String(lista.id)]
    return { tipo: 'producto' as const, precioFijo: x.precio, cantidadMinima: x.unidades > 1 ? x.unidades : null, productos: [{ id: f.id, presentacion: x.presentacion }] }
  })
}
