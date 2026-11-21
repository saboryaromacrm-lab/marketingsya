import 'server-only'
import { eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { urlMedia } from '@/lib/media'
import type { ProductoNormalizado } from '@/lib/catalogo/tipos'
import { detalleBase, pesosPromo, precioPromo } from '@/lib/promos/calculo'
import { htmlPlaca, type PrecioPieza, type ProductoPieza } from './plantillas'
import { leerConfig } from '@/lib/configuracion'
import { qrDataUri } from '@/lib/piezas/qr'
import { idsDe, limpiarDatos, placasDe, type DatosCarrusel, type ProductoNutri } from './tipos'
import { limpiarFormatosCarrusel } from '@/lib/video/tipos'

const { carruseles, productos, marcas } = esquema

export type ProductoCarrusel = ProductoPieza & { erp: ProductoNormalizado; dadoDeBaja: boolean; excluido: boolean }

/** Productos del catálogo con lo que necesitan las placas y el editor. */
export async function productosPieza(ids: number[]): Promise<Map<number, ProductoCarrusel>> {
  if (!ids.length) return new Map()
  const filas = await db
    .select({
      id: productos.id,
      nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`,
      marca: marcas.nombre,
      foto: fotoEfectiva,
      tipo: productos.tipo,
      categoria: productos.categoria,
      frase: productos.frasePiezas,
      erp: productos.erp,
      dadoDeBaja: productos.dadoDeBaja,
      excluido: productos.excluirDePiezas,
    })
    .from(productos)
    .leftJoin(marcas, eq(marcas.id, productos.marcaId))
    .where(inArray(productos.id, ids))
  return new Map(
    filas.map((p) => [p.id, {
      id: p.id, nombre: p.nombre, marca: p.marca, foto: p.foto ? urlMedia(p.foto) : null, granel: p.tipo === 'granel',
      categoria: p.categoria, frase: p.frase, erp: p.erp, dadoDeBaja: p.dadoDeBaja, excluido: p.excluido,
      presentaciones: p.erp.presentaciones.map((x) => ({ tamano: x.tamano, kg: x.kg ?? null })),
    }]),
  )
}

export async function cargarCarrusel(id: number) {
  const [c] = await db.select().from(carruseles).where(eq(carruseles.id, id))
  if (!c) return null
  const datos = limpiarDatos(c.estilo, c.datos)
  const [prods, config] = await Promise.all([productosPieza(idsDe(c.estilo, datos)), leerConfig()])
  return { carrusel: c, datos, productos: prods, contacto: config.contacto }
}
export type CarruselCargado = NonNullable<Awaited<ReturnType<typeof cargarCarrusel>>>

/** Precio NutriOferta de un producto: lista elegida menos el descuento; con su unidad y el «antes» si hay descuento. */
export function precioNutri(p: ProductoCarrusel | undefined, it: Pick<ProductoNutri, 'descuento' | 'presentacion'>, listaId: number): PrecioPieza {
  const det = p ? detalleBase(p.erp, p.granel, listaId, it.presentacion) : null
  if (!det) return null
  const promo = precioPromo(det.precio, { descuento: it.descuento, cantidadMinima: null, precioFijo: null })
  if (promo == null) return null
  return { texto: pesosPromo(promo), unidad: det.unidad, antes: promo < det.precio ? pesosPromo(det.precio) : null }
}

export const rutaPlaca = (id: number, n: number) => `/render/carrusel/${id}?placa=${n}`
// Historia: la misma placa en 1080×1920 («formato» y «pagina» dan el nombre del archivo: historia-2.jpg)
export const rutaHistoria = (id: number, n: number) => `/render/carrusel/${id}?formato=historia&pagina=${n}&placa=${n}`

export function planDePlacas(c: CarruselCargado) {
  return placasDe(c.carrusel.estilo, c.datos).map((p, i) => ({ ...p, numero: i + 1, ruta: rutaPlaca(c.carrusel.id, i + 1) }))
}

export const formatosDe = (c: CarruselCargado) => limpiarFormatosCarrusel(c.carrusel.formatos)

/** Todo lo que se exporta como imagen: las placas del carrusel y, si está marcada, su versión historia. */
export function placasExportar(c: CarruselCargado): { numero: number; nombre: string; ruta: string; grupo: 'feed' | 'historia' }[] {
  const f = formatosDe(c)
  const plan = planDePlacas(c)
  return [
    ...(f.carrusel ? plan.map((p) => ({ numero: p.numero, nombre: p.nombre, ruta: p.ruta, grupo: 'feed' as const })) : []),
    ...(f.historia ? plan.map((p) => ({ numero: p.numero, nombre: p.nombre, ruta: rutaHistoria(c.carrusel.id, p.numero), grupo: 'historia' as const })) : []),
  ]
}

export function htmlDePlaca(c: CarruselCargado, numero: number): string | null {
  const placas = placasDe(c.carrusel.estilo, c.datos)
  const placa = placas[numero - 1]
  if (!placa) return null
  return htmlPlaca({
    estilo: c.carrusel.estilo,
    datos: c.datos as DatosCarrusel,
    placa,
    indice: numero - 1,
    productos: c.productos,
    semilla: c.carrusel.id * 7919,
    precio: (it) => precioNutri(it.id != null ? c.productos.get(it.id) : undefined, it, c.carrusel.listaId),
    contacto: c.contacto,
    qr: qrDataUri(`https://${c.contacto.web}`),
  })
}
