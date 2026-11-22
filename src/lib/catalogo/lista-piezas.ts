import 'server-only'
import { and, asc, desc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { urlMedia } from '@/lib/media'
import { palabrasDeBusqueda } from './busqueda'
import { coincideExacta, parecido, SIMILITUD_MINIMA } from './listado'
import { fotoEfectiva } from './fotos-propias'
import { ultimaSincronizacionBuena } from './iniciar'
import { DIAS_NUEVOS, POR_PAGINA_LISTA, type FiltrosLista } from './lista-piezas-reglas'

// La lista de productos del asistente de Creación: solo los que sirven para piezas (con foto, activos y no excluidos),
// con filtros, orden por stock y de a 20.

const { productos, marcas, seleccion, sucursales, sincronizaciones, sincronizacionCambios } = esquema

const sirven = sql`not ${productos.dadoDeBaja} and not ${productos.excluirDePiezas}`
const conFoto = sql`${fotoEfectiva} is not null`
const desde = sql`now() - make_interval(days => ${DIAS_NUEVOS})`
// Altas de los últimos 30 días, sin contar la primera importación (ahí entró todo el catálogo)
const nuevos = sql`select c.entidad_id from ${sincronizacionCambios} c join ${sincronizaciones} s on s.id = c.sincronizacion_id
  where c.entidad = 'producto' and c.tipo = 'alta' and s.creado_en >= ${desde} and s.id <> (select min(id) from ${sincronizaciones})`
// Bajaron de precio en los últimos 30 días (el Minorista si está en el cambio; si no, el primer precio)
const bajaron = sql`select c.entidad_id from ${sincronizacionCambios} c join ${sincronizaciones} s on s.id = c.sincronizacion_id
  where c.entidad = 'producto' and c.tipo = 'precio' and s.creado_en >= ${desde}
  and coalesce((c.despues ->> 'Minorista')::numeric, (select (value)::numeric from jsonb_each_text(c.despues) limit 1))
    < coalesce((c.antes ->> 'Minorista')::numeric, (select (value)::numeric from jsonb_each_text(c.antes) limit 1))`

export async function listaParaPiezas(f: FiltrosLista, listaId: number) {
  const stock = f.sucursal ? sql<number>`coalesce((${productos.stock} ->> ${String(f.sucursal)})::numeric, 0)` : sql<number>`${productos.stockTotal}`
  const precio = sql`((${productos.preciosLista} -> ${String(listaId)} ->> 'precio')::numeric)`
  const filtros: (SQL | undefined)[] = [
    sirven,
    f.marca === 'sin' ? isNull(productos.marcaId) : f.marca != null ? eq(productos.marcaId, f.marca) : undefined,
    f.categoria ? eq(productos.categoria, f.categoria) : undefined,
    f.tipo !== 'todos' ? eq(productos.tipo, f.tipo) : undefined,
    f.nuevos ? sql`${productos.id} in (${nuevos})` : undefined,
    f.bajaron ? sql`${productos.id} in (${bajaron})` : undefined,
    f.conStock ? sql`${stock} > 0` : undefined,
  ]
  const palabras = palabrasDeBusqueda(f.q)
  const contar = async (busqueda: SQL[]) => {
    const [x] = await db.select({ con: sql<number>`count(*) filter (where ${conFoto})::int`, sin: sql<number>`count(*) filter (where ${fotoEfectiva} is null)::int` }).from(productos).where(and(...filtros, ...busqueda))
    return x
  }
  let busqueda = palabras.map(coincideExacta)
  let n = await contar(busqueda)
  let aproximada = false
  if (palabras.length && n.con === 0) {
    busqueda = palabras.map((w) => sql`${parecido(w)} >= ${SIMILITUD_MINIMA}`)
    n = await contar(busqueda)
    aproximada = true
  }
  const paginas = Math.max(1, Math.ceil(n.con / POR_PAGINA_LISTA))
  const pagina = Math.min(f.pagina, paginas)
  // Buscando: primero los que tienen las palabras en el nombre (no solo en la categoría o las etiquetas).
  // Los que no tienen stock, siempre al final.
  const nombre = sql`translate(lower(coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})), 'áéíóúüñ', 'aeiouun')`
  const enNombre = palabras.length && !aproximada ? [sql`(${sql.join(palabras.map((w) => sql`${nombre} like ${`%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`), sql` and `)}) desc`] : []
  const orden: SQL[] = [...enNombre, sql`(${stock} > 0) desc`, ...{
    stock: [sql`${stock} desc`, asc(productos.busqueda)],
    nombre: [asc(productos.busqueda)],
    'precio-asc': [sql`${precio} asc nulls last`, asc(productos.busqueda)],
    'precio-desc': [sql`${precio} desc nulls last`, asc(productos.busqueda)],
    nuevos: [desc(productos.creadoEn), desc(productos.id)],
  }[f.orden]]

  const filas = await db
    .select({
      id: productos.id,
      nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`,
      marca: marcas.nombre,
      foto: fotoEfectiva,
      granel: sql<boolean>`${productos.tipo} = 'granel'`,
      precio: sql<number | null>`${precio}`,
      presentacion: sql<string | null>`${productos.preciosLista} -> ${String(listaId)} ->> 'presentacion'`,
      stock: sql<number>`${stock}::float`,
      nuevo: sql<boolean>`${productos.id} in (${nuevos})`,
      elegido: sql<boolean>`exists (select 1 from ${seleccion} where ${seleccion.productoId} = ${productos.id})`,
    })
    .from(productos)
    .leftJoin(marcas, eq(marcas.id, productos.marcaId))
    .where(and(conFoto, ...filtros, ...busqueda))
    .orderBy(...orden)
    .limit(POR_PAGINA_LISTA)
    .offset((pagina - 1) * POR_PAGINA_LISTA)

  return {
    productos: filas.map((p) => ({ ...p, foto: p.foto ? urlMedia(p.foto) : null, stock: Number(p.stock) || 0, precio: p.precio == null ? null : Number(p.precio) })),
    total: n.con,
    sinFoto: n.sin,
    pagina, paginas, aproximada,
  }
}
export type ListaPiezas = Awaited<ReturnType<typeof listaParaPiezas>>
export type ProductoLista = ListaPiezas['productos'][number]

/** Opciones de los filtros (solo de los productos que sirven para piezas) y desde cuándo es el stock. */
export async function opcionesListaPiezas() {
  const base = and(sirven, conFoto)
  const [mars, cats, sucs, ult, cuantosNuevos] = await Promise.all([
    db.select({ id: marcas.id, nombre: marcas.nombre, n: sql<number>`count(${productos.id})::int` }).from(marcas).innerJoin(productos, and(eq(productos.marcaId, marcas.id), base)).groupBy(marcas.id, marcas.nombre).orderBy(asc(marcas.nombre)),
    db.select({ nombre: productos.categoria, n: sql<number>`count(*)::int` }).from(productos).where(and(base, isNotNull(productos.categoria))).groupBy(productos.categoria).orderBy(asc(productos.categoria)),
    db.select().from(sucursales).orderBy(asc(sucursales.id)),
    ultimaSincronizacionBuena(),
    db.select({ n: sql<number>`count(*)::int` }).from(productos).where(and(base, sql`${productos.id} in (${nuevos})`)),
  ])
  return {
    marcas: mars,
    categorias: cats.map((c) => ({ nombre: c.nombre!, n: c.n })),
    sucursales: sucs,
    stockAl: ult?.terminadaEn?.toISOString() ?? null,
    nuevos: cuantosNuevos[0]?.n ?? 0,
  }
}
export type OpcionesListaPiezas = Awaited<ReturnType<typeof opcionesListaPiezas>>
