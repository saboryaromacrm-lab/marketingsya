import 'server-only'
import { and, asc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { palabrasDeBusqueda } from './busqueda'
import { POR_PAGINA, type Filtros, type Pestana } from './filtros'

const { productos, marcas, listas } = esquema

// Por debajo de esto, un nombre no se considera «parecido» (probado con el catálogo real:
// «aseite» → aceite 0,44 · «yerva» → yerba 0,50 · «quinua» → quinoa 0,57).
const SIMILITUD_MINIMA = 0.4

const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)
const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Palabras de 3 letras o menos se buscan enteras: si no, «te» encuentra «aceite» y «chocolate».
function coincideExacta(w: string): SQL {
  return w.length <= 3
    ? sql`${productos.busqueda} ~ ${`\\m${escaparRegex(w)}\\M`}`
    : sql`${productos.busqueda} like ${`%${escaparLike(w)}%`}`
}

const parecido = (w: string) => sql`word_similarity(${w}, ${productos.busqueda})`
// Para ordenar (probado con el catálogo real):
// - la similitud estricta compara palabras enteras: sin ella, «yerva» pone primero «conservas» (comparte «erva»);
// - suma si la palabra está en el nombre y no solo en la categoría: «yerba mate» antes que «mate cocido»;
// - suma si es la primera palabra del nombre: «aceite de oliva» antes que «atún en aceite».
const nombreNormalizado = sql`translate(lower(${productos.nombre}), 'áéíóúüñ', 'aeiouun')`
const relevanciaDe = (w: string) => sql`(
  2 * strict_word_similarity(${w}, ${productos.busqueda}) + word_similarity(${w}, ${productos.busqueda})
  + 2 * strict_word_similarity(${w}, ${nombreNormalizado}) + similarity(${w}, split_part(${nombreNormalizado}, ' ', 1))
)`

function condicionPestana(p: Pestana): SQL {
  switch (p) {
    case 'envasados': return sql`not ${productos.dadoDeBaja} and ${productos.tipo} = 'entero'`
    case 'granel': return sql`not ${productos.dadoDeBaja} and ${productos.tipo} = 'granel'`
    case 'baja': return sql`${productos.dadoDeBaja}`
    default: return sql`not ${productos.dadoDeBaja}`
  }
}

function condicionesDeFiltros(f: Filtros): (SQL | undefined)[] {
  const precioLista = sql`(${productos.preciosLista} -> ${String(f.lista)})`
  return [
    f.categoria ? eq(productos.categoria, f.categoria) : undefined,
    f.subcategoria ? eq(productos.subcategoria, f.subcategoria) : undefined,
    f.marca === 'sin' ? isNull(productos.marcaId) : f.marca != null ? eq(productos.marcaId, f.marca) : undefined,
    f.etiqueta ? sql`${productos.etiquetas} @> array[${f.etiqueta}]::text[]` : undefined,
    f.foto === 'con' ? isNotNull(productos.imagenArchivo) : f.foto === 'sin' ? isNull(productos.imagenArchivo) : undefined,
    f.sinPrecio ? sql`${precioLista} is null` : undefined,
  ]
}

export type FilaProducto = Awaited<ReturnType<typeof buscarProductos>>['filas'][number]

export async function buscarProductos(f: Filtros) {
  const palabras = palabrasDeBusqueda(f.q)
  const filtros = condicionesDeFiltros(f)

  // 1) Búsqueda exacta. 2) Si no hay nada y se buscó algo, búsqueda por parecido.
  const contar = async (busqueda: SQL[]) => {
    const [fila] = await db
      .select({
        todos: sql<number>`count(*) filter (where ${condicionPestana('todos')})::int`,
        envasados: sql<number>`count(*) filter (where ${condicionPestana('envasados')})::int`,
        granel: sql<number>`count(*) filter (where ${condicionPestana('granel')})::int`,
        baja: sql<number>`count(*) filter (where ${condicionPestana('baja')})::int`,
      })
      .from(productos)
      .where(and(...filtros, ...busqueda))
    return fila
  }
  let busqueda = palabras.map(coincideExacta)
  let conteos = await contar(busqueda)
  let aproximada = false
  if (palabras.length && conteos.todos + conteos.baja === 0) {
    busqueda = palabras.map((w) => sql`${parecido(w)} >= ${SIMILITUD_MINIMA}`)
    conteos = await contar(busqueda)
    aproximada = true
  }

  const total = conteos[f.pestana]
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const pagina = Math.min(f.pagina, paginas)

  const precio = sql`((${productos.preciosLista} -> ${String(f.lista)} ->> 'precio')::numeric)`
  const relevancia = palabras.length ? sql.join(palabras.map(relevanciaDe), sql` + `) : sql`0`
  const orden: SQL[] = {
    relevancia: [sql`${relevancia} desc`, asc(productos.busqueda)],
    nombre: [asc(productos.busqueda)],
    'precio-asc': [sql`${precio} asc nulls last`, asc(productos.busqueda)],
    'precio-desc': [sql`${precio} desc nulls last`, asc(productos.busqueda)],
    nuevos: [sql`${productos.id} desc`],
  }[f.orden]

  const filas = await db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      nombreSugerido: productos.nombreSugerido,
      nombrePiezas: productos.nombrePiezas,
      marcaId: productos.marcaId,
      marca: marcas.nombre,
      categoria: productos.categoria,
      subcategoria: productos.subcategoria,
      etiquetas: productos.etiquetas,
      tipo: productos.tipo,
      estado: productos.estado,
      imagenArchivo: productos.imagenArchivo,
      preciosLista: productos.preciosLista,
      dadoDeBaja: productos.dadoDeBaja,
      fraccionados: sql<number>`jsonb_array_length(${productos.erp} -> 'presentaciones')`,
    })
    .from(productos)
    .leftJoin(marcas, eq(marcas.id, productos.marcaId))
    .where(and(condicionPestana(f.pestana), ...filtros, ...busqueda))
    .orderBy(...orden)
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA)

  return { filas, conteos, total, pagina, paginas, aproximada }
}

/** Opciones de los selects, con cuántos productos activos tiene cada una. Todo sale de la base. */
export async function opcionesDeFiltros() {
  const activos = sql`not ${productos.dadoDeBaja}`
  const [cats, mars, sinMarca, etqs, lsts] = await Promise.all([
    db
      .select({ categoria: productos.categoria, subcategoria: productos.subcategoria, n: sql<number>`count(*)::int` })
      .from(productos)
      .where(and(activos, isNotNull(productos.categoria)))
      .groupBy(productos.categoria, productos.subcategoria)
      .orderBy(asc(productos.categoria), asc(productos.subcategoria)),
    db
      .select({ id: marcas.id, nombre: marcas.nombre, n: sql<number>`count(${productos.id})::int` })
      .from(marcas)
      .innerJoin(productos, and(eq(productos.marcaId, marcas.id), activos))
      .groupBy(marcas.id, marcas.nombre)
      .orderBy(asc(marcas.nombre)),
    db.select({ n: sql<number>`count(*)::int` }).from(productos).where(and(activos, isNull(productos.marcaId))),
    db.execute<{ etiqueta: string; n: number }>(
      sql`select e as etiqueta, count(*)::int as n from ${productos}, unnest(${productos.etiquetas}) e where not ${productos.dadoDeBaja} group by e order by e`,
    ),
    db.select().from(listas).orderBy(asc(listas.orden), asc(listas.id)),
  ])

  const categorias = new Map<string, { n: number; subcategorias: { nombre: string; n: number }[] }>()
  for (const c of cats) {
    const g = categorias.get(c.categoria!) ?? { n: 0, subcategorias: [] }
    g.n += c.n
    if (c.subcategoria) g.subcategorias.push({ nombre: c.subcategoria, n: c.n })
    categorias.set(c.categoria!, g)
  }
  return {
    categorias: [...categorias.entries()].map(([nombre, g]) => ({ nombre, ...g })),
    marcas: mars,
    sinMarca: sinMarca[0]?.n ?? 0,
    etiquetas: etqs.rows,
    listas: lsts,
  }
}

export type OpcionesDeFiltros = Awaited<ReturnType<typeof opcionesDeFiltros>>
