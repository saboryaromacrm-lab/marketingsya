'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import type { EstiloCarrusel } from '@/lib/db/esquema'
import { encolarExportacion } from '@/lib/piezas/exportar'
import { cargarPieza } from '@/lib/publicaciones/piezas'
import { cargarCarrusel, planDePlacas, precioNutri, productosPieza } from '@/lib/carruseles/datos'
import { datosIniciales, ESTILOS, idsDe, limpiarDatos, type DatosCarrusel, type DatosNutriofertas, type DatosRecetas } from '@/lib/carruseles/tipos'
import { hoyFormosa } from '@/lib/promos/fechas'
import { leerConfig } from '@/lib/configuracion'
import { detalleBase } from '@/lib/promos/calculo'

const { carruseles, seleccion, productos, listas } = esquema
const esEstilo = (x: unknown): x is EstiloCarrusel => x === 'lanzamiento' || x === 'nutriofertas' || x === 'recetas'
type Resultado<T> = ({ ok: true } & T) | { error: string }

/** Lo que el editor muestra de cada producto (nombre, foto, precio con su unidad y textos para sugerir). */
export async function infoProductosCarrusel(ids: number[], listaId: number) {
  const limpios = (Array.isArray(ids) ? ids : []).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60)
  const mapa = await productosPieza(limpios)
  return Object.fromEntries([...mapa.values()].map((p) => {
    const precio = precioNutri(p, { descuento: 0, presentacion: null }, listaId)
    return [p.id, {
      id: p.id, nombre: p.nombre, marca: p.marca, foto: p.foto, granel: p.granel, categoria: p.categoria, frase: p.frase,
      presentaciones: p.presentaciones, usable: !!p.foto && !p.dadoDeBaja && !p.excluido,
      precio: precio ? `${precio.texto} ${precio.unidad}` : null,
      // Precio base (sin descuento) por fraccionado ('' = el de siempre), para calcular el precio NutriOferta en el editor
      bases: Object.fromEntries(['', ...p.presentaciones.map((x) => x.tamano)].map((pr) => [pr, detalleBase(p.erp, p.granel, listaId, pr || null)])),
    }]
  }))
}
export type InfoCarrusel = Awaited<ReturnType<typeof infoProductosCarrusel>>[number]

/** Carrusel nuevo con el estilo elegido y los productos marcados en el catálogo. */
export async function crearCarrusel(estilo: string) {
  if (!esEstilo(estilo)) return
  const elegidos = await db.select({ id: seleccion.productoId }).from(seleccion).orderBy(asc(seleccion.agregadoEn))
  const ids = elegidos.map((e) => e.id)
  const hoy = hoyFormosa()
  const [{ id }] = await db
    .insert(carruseles)
    .values({ estilo, listaId: (await leerConfig()).piezas.listaId, titulo: `${ESTILOS[estilo].nombre} ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}`, datos: datosIniciales(estilo, ids) as unknown as Record<string, unknown> })
    .returning({ id: carruseles.id })
  if (ids.length) {
    await db.delete(seleccion)
    revalidatePath('/', 'layout')
  }
  redirect(`/carruseles/${id}`)
}

type Guardar = { titulo: string; listaId: number; estilo: EstiloCarrusel; datos: unknown; textoPosteo: string | null }

export async function guardarCarrusel(id: number, g: Guardar): Promise<Resultado<{ placas: { numero: number; nombre: string; ruta: string }[] }>> {
  if (!esEstilo(g.estilo)) return { error: 'Estilo desconocido.' }
  const [lista] = await db.select({ id: listas.id }).from(listas).where(eq(listas.id, Number(g.listaId)))
  if (!lista) return { error: 'Esa lista de precios no existe.' }
  const datos = limpiarDatos(g.estilo, g.datos)
  // Ids que no existen en el catálogo se descartan (quedan como «elegí un producto»)
  const ids = idsDe(g.estilo, datos)
  const existen = new Set(ids.length ? (await db.select({ id: productos.id }).from(productos).where(inArray(productos.id, ids))).map((p) => p.id) : [])
  const limpio = JSON.parse(JSON.stringify(datos, (k, v) => ((k === 'id' || k === 'foto' || k === 'producto') && typeof v === 'number' && !existen.has(v) ? null : v)))
  const titulo = typeof g.titulo === 'string' && g.titulo.trim() ? g.titulo.trim().slice(0, 80) : ESTILOS[g.estilo].nombre
  const textoPosteo = typeof g.textoPosteo === 'string' && g.textoPosteo.trim() ? g.textoPosteo.slice(0, 2200) : null
  const [c] = await db
    .update(carruseles)
    .set({ estilo: g.estilo, titulo, listaId: lista.id, datos: limpio, textoPosteo, actualizadoEn: new Date() })
    .where(eq(carruseles.id, id))
    .returning({ id: carruseles.id })
  if (!c) return { error: 'Ese carrusel ya no existe.' }
  await guardarFrases(g.estilo, limpio as DatosCarrusel)
  revalidatePath('/carruseles')
  const cargado = await cargarCarrusel(id)
  return { ok: true, placas: cargado ? planDePlacas(cargado).map(({ numero, nombre, ruta }) => ({ numero, nombre, ruta })) : [] }
}

/** Las frases escritas quedan guardadas en cada producto, así la próxima vez salen solas. */
async function guardarFrases(estilo: EstiloCarrusel, d: DatosCarrusel) {
  const frases: [number, string][] = []
  if (estilo === 'nutriofertas') for (const p of (d as DatosNutriofertas).productos) if (p.id && p.frase) frases.push([p.id, p.frase])
  if (estilo === 'recetas') for (const p of (d as DatosRecetas).porQue.items) if (p.id && p.texto) frases.push([p.id, p.texto])
  for (const [id, frase] of frases) await db.update(productos).set({ frasePiezas: frase.slice(0, 160) }).where(eq(productos.id, id))
}

export async function duplicarCarrusel(id: number) {
  const [c] = await db.select().from(carruseles).where(eq(carruseles.id, id))
  if (!c) return
  const [{ id: nuevo }] = await db
    .insert(carruseles)
    .values({ estilo: c.estilo, titulo: `${c.titulo} (copia)`.slice(0, 80), listaId: c.listaId, datos: c.datos, textoPosteo: c.textoPosteo })
    .returning({ id: carruseles.id })
  redirect(`/carruseles/${nuevo}`)
}

export async function borrarCarrusel(id: number) {
  await db.delete(carruseles).where(eq(carruseles.id, id))
  revalidatePath('/carruseles')
  redirect('/carruseles')
}

export async function exportarCarrusel(id: number): Promise<Resultado<{ exportacionId: number }>> {
  const c = await cargarCarrusel(id)
  if (!c) return { error: 'Ese carrusel ya no existe.' }
  const ids = idsDe(c.carrusel.estilo, c.datos)
  const sinFoto = ids.map((x) => c.productos.get(x)).filter((p) => p && !p.foto)
  if (sinFoto.length) return { error: `No se puede exportar: ${sinFoto.map((p) => `«${p!.nombre}»`).join(', ')} no ${sinFoto.length === 1 ? 'tiene' : 'tienen'} foto.` }
  const placas = planDePlacas(c)
  try {
    const exportacionId = await encolarExportacion('carrusel', placas.map((p) => p.ruta), id, (await cargarPieza('carrusel', id))?.huella ?? null)
    await db.update(carruseles).set({ exportacionId }).where(eq(carruseles.id, id))
    return { ok: true, exportacionId }
  } catch {
    return { error: 'No se pudo iniciar la exportación.' }
  }
}

export async function listarCarruseles() {
  const { exportaciones } = esquema
  return db
    .select({ id: carruseles.id, titulo: carruseles.titulo, estilo: carruseles.estilo, datos: carruseles.datos, actualizadoEn: carruseles.actualizadoEn, zip: exportaciones.zip, estadoExportacion: exportaciones.estado })
    .from(carruseles)
    .leftJoin(exportaciones, eq(exportaciones.id, carruseles.exportacionId))
    .orderBy(desc(carruseles.actualizadoEn))
    .limit(200)
}

export async function cantidadElegidosCarrusel() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(seleccion)
  return n
}
