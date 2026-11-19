// Contenido de cada estilo de carrusel. Los productos van por id (se leen del catálogo al dibujar);
// los textos con «/» marcan dónde corta el renglón. Los campos en null se arman solos desde el catálogo.

import type { EstiloCarrusel } from '@/lib/db/esquema'

export type Id = number | null
export type Variante = 'auto' | 'derecha'

export type DatosLanzamiento = {
  placas: { productos: boolean; comoComprar: boolean; porQue: boolean }
  portada: { kicker: string; titulo: string; pastilla: string; pie: string; productos: Id[] }
  productos: { titulo: string; subtitulo: string; pie: string; items: { id: Id; etiqueta: string | null }[] }
  comoComprar: { titulo: string; foto: Id; pasos: { titulo: string; texto: string }[] }
  porQue: { titulo: string; sellos: string[]; items: { titulo: string; texto: string }[] }
  cierre: { titulo: string; pie: string }
}

export type ProductoNutri = { id: Id; nombre: string | null; linea: string | null; descuento: number | null; frase: string | null; presentacion: string | null }
export type DatosNutriofertas = {
  variante: Variante
  portada: { titulo: string; bajada: string; destacado: string; texto: string; boton: string; sello: string; producto: Id }
  productos: ProductoNutri[]
  cierre: { titulo: string; bajada: string }
}

export type DatosRecetas = {
  placas: { porQue: boolean }
  portada: { titulo: string; bajada: string; destacado: string; texto: string; boton: string; sello: string; producto: Id }
  ingredientes: { titulo: string; bajada: string; sello: string; items: { id: Id; cantidad: string; texto: string | null }[] }
  preparacion: { titulo: string; foto: Id; pasos: string[] }
  porQue: { titulo: string; sello: string; items: { id: Id; nombre: string | null; texto: string | null }[] }
  cierre: { titulo: string; bajada: string }
}

export type DatosCarrusel = DatosLanzamiento | DatosNutriofertas | DatosRecetas

export const ESTILOS: Record<EstiloCarrusel, { nombre: string; descripcion: string }> = {
  lanzamiento: { nombre: 'Lanzamiento', descripcion: 'Papel y ramita de olivo. Para novedades y la tienda. Hasta 9 fotos, sin precio.' },
  nutriofertas: { nombre: 'NutriOfertas', descripcion: 'Ondas durazno y plato. Un producto por placa con su precio.' },
  recetas: { nombre: 'Recetas', descripcion: 'Ondas lima. Ingredientes del catálogo, pasos y por qué hace bien.' },
}

export const MAX = { nutriProductos: 6, lanzamientoItems: 6, ingredientes: 5, porQue: 4, pasos: 4, pasosMin: 2 }

const tomar = (ids: number[], i: number): Id => ids[i] ?? null

/** Contenido de entrada de un carrusel nuevo: los textos de los diseños aprobados y los productos elegidos. */
export function datosIniciales(estilo: EstiloCarrusel, ids: number[]): DatosCarrusel {
  if (estilo === 'lanzamiento') {
    return {
      placas: { productos: true, comoComprar: true, porQue: true },
      portada: { kicker: '¡Novedad!', titulo: '¡Lanzamos / nuestra / tienda online!', pastilla: 'ahora Online', pie: 'deslizá y conocé más', productos: [tomar(ids, 0), tomar(ids, 1)] },
      productos: {
        titulo: 'Todo lo que / te hace bien',
        subtitulo: 'Frutos secos, semillas, lácteos y mucho más.',
        pie: 'y las mejores marcas, en un solo lugar',
        items: Array.from({ length: Math.min(MAX.lanzamientoItems, Math.max(ids.length, 1)) }, (_, i) => ({ id: tomar(ids, i), etiqueta: null })),
      },
      comoComprar: {
        titulo: 'Comprar es / así de fácil',
        foto: tomar(ids, ids.length > 2 ? 2 : 0),
        pasos: [
          { titulo: 'Entrá con tu WhatsApp', texto: 'Ingresás a la tienda online solo con tu número.' },
          { titulo: 'Elegí tus productos', texto: 'Sumá al carrito lo que quieras, sin mínimo de compra.' },
          { titulo: 'Lo retirás o te lo llevamos', texto: 'Coordinamos la entrega por WhatsApp. Envíos a todo Formosa Capital.' },
        ],
      },
      porQue: {
        titulo: '¿Por qué / Sabor y Aroma?',
        sellos: ['Precios / bajos', '100 % / natural', 'Sin mínimo / de compra'],
        items: [
          { titulo: 'Precios bajos que nutren:', texto: 'el mismo precio que en el local, con NutriOfertas todas las semanas.' },
          { titulo: 'Envíos a todo Formosa Capital.', texto: 'O lo retirás cuando quieras.' },
        ],
      },
      cierre: { titulo: 'Te esperamos en / nuestra tienda virtual', pie: 'Envíos a todo Formosa Capital · Sin mínimo de compra' },
    }
  }
  if (estilo === 'nutriofertas') {
    return {
      variante: 'auto',
      portada: { titulo: 'Nutri / Ofertas', bajada: 'de la semana', destacado: 'Sin mínimo', texto: 'Precios bajos que nutren, igual que en el local.', boton: 'Ver ofertas →', sello: 'Precios / bajos', producto: tomar(ids, 0) },
      productos: (ids.length ? ids.slice(0, MAX.nutriProductos) : [null]).map((id) => ({ id, nombre: null, linea: null, descuento: 0, frase: null, presentacion: null })),
      cierre: { titulo: 'Aprovechá las / NutriOfertas', bajada: 'Cambian todas las semanas' },
    }
  }
  return {
    placas: { porQue: true },
    portada: { titulo: 'Desayuno / saludable', bajada: 'idea de la semana', destacado: 'Fácil y rico', texto: 'Todo lo que necesitás, en un solo lugar.', boton: 'Deslizá y mirá →', sello: 'Natural', producto: tomar(ids, 0) },
    ingredientes: {
      titulo: 'Ingredientes',
      bajada: 'Para 1 bowl',
      sello: 'Todo en / la tienda',
      items: (ids.length ? ids.slice(0, MAX.ingredientes) : [null]).map((id) => ({ id, cantidad: '', texto: null })),
    },
    preparacion: { titulo: 'Preparación', foto: tomar(ids, 0), pasos: ['', '', ''] },
    porQue: { titulo: '¿Por qué te / hace bien?', sello: 'Natural', items: ids.slice(0, MAX.porQue).map((id) => ({ id, nombre: null, texto: null })) },
    cierre: { titulo: 'Conseguí todo / en un solo lugar', bajada: 'Ingredientes de esta receta' },
  }
}

// ---------------------------------------------------------------------------
// Limpieza de lo que llega del navegador: se arma desde los datos de entrada,
// tomando solo campos conocidos, con el tipo y el largo correctos.
// ---------------------------------------------------------------------------
const NUMEROS = new Set(['id', 'foto', 'producto'])
const LARGO_TEXTO = 160

function limpiarValor(molde: unknown, valor: unknown, clave: string, maximos: Record<string, number>, ruta: string): unknown {
  if (Array.isArray(molde)) {
    const max = maximos[ruta] ?? molde.length
    const ejemplo = molde[0]
    const lista = Array.isArray(valor) ? valor.slice(0, max) : molde
    // Listas de ids (por ejemplo, los 2 productos de la portada): cada elemento se valida como id
    const claveItem = typeof ejemplo === 'number' ? 'id' : clave
    return lista.map((x) => limpiarValor(ejemplo ?? (typeof x === 'string' ? '' : null), x, claveItem, maximos, `${ruta}[]`))
  }
  if (molde !== null && typeof molde === 'object') {
    const v = valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {}
    return Object.fromEntries(Object.entries(molde).map(([k, m]) => [k, limpiarValor(m, v[k], k, maximos, ruta ? `${ruta}.${k}` : k)]))
  }
  if (typeof molde === 'boolean') return typeof valor === 'boolean' ? valor : molde
  if (NUMEROS.has(clave)) return Number.isInteger(valor) && (valor as number) > 0 ? valor : null
  if (clave === 'descuento') return typeof valor === 'number' && valor >= 0 && valor <= 90 ? Math.round(valor * 100) / 100 : 0
  if (clave === 'variante') return valor === 'derecha' ? 'derecha' : 'auto'
  // Textos: los que van en null (se arman solos) aceptan null; los demás, texto
  if (valor === null || valor === undefined) return molde === null ? null : ''
  if (typeof valor !== 'string') return molde
  const t = valor.replace(/\s+/g, ' ').trim().slice(0, LARGO_TEXTO)
  return molde === null && !t ? null : t
}

const MAXIMOS: Record<EstiloCarrusel, Record<string, number>> = {
  lanzamiento: { 'portada.productos': 2, 'productos.items': MAX.lanzamientoItems, 'comoComprar.pasos': 3, 'porQue.sellos': 3, 'porQue.items': 2 },
  nutriofertas: { productos: MAX.nutriProductos },
  recetas: { 'ingredientes.items': MAX.ingredientes, 'preparacion.pasos': MAX.pasos, 'porQue.items': MAX.porQue },
}

// Moldes con un elemento de ejemplo por lista (los datos de entrada con un producto)
const MOLDES: Record<EstiloCarrusel, DatosCarrusel> = {
  lanzamiento: datosIniciales('lanzamiento', [1, 2, 3]),
  nutriofertas: datosIniciales('nutriofertas', [1]),
  recetas: { ...(datosIniciales('recetas', [1]) as DatosRecetas), preparacion: { titulo: '', foto: null, pasos: [''] } },
}

export function limpiarDatos(estilo: EstiloCarrusel, valor: unknown): DatosCarrusel {
  const d = limpiarValor(MOLDES[estilo], valor, '', MAXIMOS[estilo], '') as DatosCarrusel
  // Listas que no pueden quedar vacías
  if (estilo === 'nutriofertas' && !(d as DatosNutriofertas).productos.length) (d as DatosNutriofertas).productos = [{ id: null, nombre: null, linea: null, descuento: 0, frase: null, presentacion: null }]
  if (estilo === 'recetas') {
    const r = d as DatosRecetas
    if (!r.ingredientes.items.length) r.ingredientes.items = [{ id: null, cantidad: '', texto: null }]
    while (r.preparacion.pasos.length < MAX.pasosMin) r.preparacion.pasos.push('')
  }
  if (estilo === 'lanzamiento' && !(d as DatosLanzamiento).productos.items.length) (d as DatosLanzamiento).productos.items = [{ id: null, etiqueta: null }]
  return d
}

// ---------------------------------------------------------------------------
// Placas que salen, en orden
// ---------------------------------------------------------------------------
export type ClavePlaca = 'portada' | 'productos' | 'comoComprar' | 'porQue' | 'cierre' | 'ingredientes' | 'preparacion' | `producto-${number}`
export type PlacaCarrusel = { clave: ClavePlaca; nombre: string }

export function placasDe(estilo: EstiloCarrusel, d: DatosCarrusel): PlacaCarrusel[] {
  if (estilo === 'lanzamiento') {
    const l = d as DatosLanzamiento
    return [
      { clave: 'portada', nombre: 'Portada' },
      ...(l.placas.productos ? [{ clave: 'productos' as const, nombre: 'Productos' }] : []),
      ...(l.placas.comoComprar ? [{ clave: 'comoComprar' as const, nombre: 'Cómo comprar' }] : []),
      ...(l.placas.porQue ? [{ clave: 'porQue' as const, nombre: '¿Por qué?' }] : []),
      { clave: 'cierre', nombre: 'Cierre' },
    ]
  }
  if (estilo === 'nutriofertas') {
    const n = d as DatosNutriofertas
    return [{ clave: 'portada', nombre: 'Portada' }, ...n.productos.map((_, k) => ({ clave: `producto-${k}` as const, nombre: `Producto ${k + 1}` })), { clave: 'cierre', nombre: 'Cierre' }]
  }
  const r = d as DatosRecetas
  return [
    { clave: 'portada', nombre: 'Portada' },
    { clave: 'ingredientes', nombre: 'Ingredientes' },
    { clave: 'preparacion', nombre: 'Preparación' },
    ...(r.placas.porQue ? [{ clave: 'porQue' as const, nombre: '¿Por qué?' }] : []),
    { clave: 'cierre', nombre: 'Cierre' },
  ]
}

/** Todos los productos que usa el carrusel (para leerlos del catálogo de una vez). */
export function idsDe(estilo: EstiloCarrusel, d: DatosCarrusel): number[] {
  const ids: Id[] = []
  if (estilo === 'lanzamiento') {
    const l = d as DatosLanzamiento
    ids.push(...l.portada.productos, ...l.productos.items.map((x) => x.id), l.comoComprar.foto)
  } else if (estilo === 'nutriofertas') {
    const n = d as DatosNutriofertas
    ids.push(n.portada.producto, ...n.productos.map((x) => x.id))
  } else {
    const r = d as DatosRecetas
    ids.push(r.portada.producto, r.preparacion.foto, ...r.ingredientes.items.map((x) => x.id), ...r.porQue.items.map((x) => x.id))
  }
  return [...new Set(ids.filter((x): x is number => x != null))]
}
