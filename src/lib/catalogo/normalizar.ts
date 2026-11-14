// Convierte la respuesta cruda de la API en datos limpios y estables.
// Es una función pura: no toca la base ni la red, así se puede probar entera.

import { arreglarCodificacion } from './codificacion'
import { nombreSugerido } from './nombres'
import type { CatalogoApi, CatalogoNormalizado, MarcaNormalizada, Precio, PrecioApi, ProductoApi, ProductoNormalizado } from './tipos'

export class CatalogoInvalido extends Error {}

// Subir este número cuando cambien las reglas de limpieza (etiquetas, nombres, codificación):
// la próxima sincronización reprocesa todo aunque el ERP diga que no cambió nada.
export const VERSION_NORMALIZACION = 1

const texto = (v: unknown) => (typeof v === 'string' ? arreglarCodificacion(v.trim().replace(/\s+/g, ' ')) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// «...imagenes/producto/2410?v=1792763591690» → { url, version: '1792763591690' }
export function leerImagen(url: unknown): { url: string; version: string } | null {
  if (typeof url !== 'string' || !url.startsWith('http')) return null
  try {
    const u = new URL(url)
    return { url, version: u.searchParams.get('v') ?? 'sin-version' }
  } catch {
    return null
  }
}

function precio(p: PrecioApi): Precio {
  return {
    listaId: num(p.listaId),
    modalidad: texto(p.modalidad),
    precio: num(p.precio),
    unidades: num(p.unidades) || 1,
    precioFormato: num(p.precioFormato),
    unidadesMinimas: num(p.unidadesMinimas),
    codigoBarras: texto(p.codigoBarras),
  }
}

// Orden fijo para que la misma información dé siempre la misma huella.
const ordenPrecios = (a: Precio, b: Precio) => a.listaId - b.listaId || a.unidades - b.unidades || a.precio - b.precio

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const clave = (s: string) => quitarTildes(s).toLowerCase().replace(/\s+/g, ' ').trim()
const cantidadTildes = (s: string) => s.normalize('NFD').replace(/[^̀-ͯ]/g, '').length

/**
 * Agrupa variantes que solo difieren en tildes o mayúsculas y elige una:
 * primero la que tiene tildes («SIN AZÚCAR» antes que «SIN AZUCAR»),
 * después la más usada («Frutas deshidratadas» 16 veces antes que «Frutas Deshidratadas» 3).
 */
export function unificarVariantes(valores: string[]): Map<string, string> {
  const grupos = new Map<string, Map<string, number>>()
  for (const v of valores) {
    if (!v) continue
    const g = grupos.get(clave(v)) ?? new Map<string, number>()
    g.set(v, (g.get(v) ?? 0) + 1)
    grupos.set(clave(v), g)
  }
  const elegido = new Map<string, string>()
  for (const g of grupos.values()) {
    const [ganador] = [...g.entries()].sort((a, b) => cantidadTildes(b[0]) - cantidadTildes(a[0]) || b[1] - a[1])
    for (const v of g.keys()) elegido.set(v, ganador[0])
  }
  return elegido
}

// Etiquetas que quedaron cortadas o vacías («sin»).
const ETIQUETAS_SUELTAS = new Set(['SIN', 'CON', 'DE', 'Y'])

function validar(api: unknown): asserts api is CatalogoApi {
  const a = api as Partial<CatalogoApi>
  if (!a || typeof a !== 'object') throw new CatalogoInvalido('La respuesta no es un objeto JSON.')
  for (const campo of ['productos', 'marcas', 'listas', 'sucursales'] as const) {
    if (!Array.isArray(a[campo])) throw new CatalogoInvalido(`La respuesta no trae «${campo}».`)
  }
}

export function normalizarCatalogo(api: unknown): CatalogoNormalizado & { descartados: number } {
  validar(api)
  let descartados = 0
  const crudos = api.productos.filter((p): p is ProductoApi => {
    const ok = !!p && typeof p.id === 'number' && typeof p.nombre === 'string' && p.nombre.trim() !== ''
    if (!ok) descartados++
    return ok
  })

  const etiquetasLimpias = (p: ProductoApi) =>
    (Array.isArray(p.etiquetas) ? p.etiquetas : []).map((e) => texto(e).toLocaleUpperCase('es')).filter((e) => e.length >= 3 && !ETIQUETAS_SUELTAS.has(e))

  const etiquetas = unificarVariantes(crudos.flatMap(etiquetasLimpias))
  const categorias = unificarVariantes(crudos.map((p) => texto(p.categoria)))
  const subcategorias = unificarVariantes(crudos.map((p) => texto(p.subcategoria)))

  const productos: ProductoNormalizado[] = crudos.map((p) => {
    const nombre = texto(p.nombre)
    const categoria = texto(p.categoria)
    const subcategoria = texto(p.subcategoria)
    return {
      id: p.id,
      nombre,
      nombreErp: typeof p.nombre === 'string' ? p.nombre : '',
      nombreSugerido: nombreSugerido(nombre),
      descripcion: texto(p.descripcion),
      codigo: texto(p.codigo),
      codigoBarras: texto(p.codigoBarras),
      dun: texto(p.dun),
      marcaId: typeof p.marcaId === 'number' && p.marcaId > 0 ? p.marcaId : null,
      categoria: categoria ? (categorias.get(categoria) ?? categoria) : null,
      subcategoria: subcategoria ? (subcategorias.get(subcategoria) ?? subcategoria) : null,
      etiquetas: [...new Set(etiquetasLimpias(p).map((e) => etiquetas.get(e) ?? e))].sort(),
      tipo: p.tipo === 'granel' ? 'granel' : 'entero',
      unidad: texto(p.unidad),
      estado: texto(p.estado) || 'activo',
      iva: num(p.iva),
      imagen: leerImagen(p.imagen),
      precios: (Array.isArray(p.precios) ? p.precios : []).map(precio).sort(ordenPrecios),
      presentaciones: (Array.isArray(p.presentaciones) ? p.presentaciones : [])
        .filter((pr) => pr && typeof pr.id === 'number')
        .map((pr) => ({
          id: pr.id,
          tamano: texto(pr.tamano),
          kg: num(pr.kg),
          codigoBarras: texto(pr.codigoBarras),
          precios: (Array.isArray(pr.precios) ? pr.precios : []).map(precio).sort(ordenPrecios),
        }))
        .sort((a, b) => b.kg - a.kg || a.id - b.id),
    }
  })

  const marcas: MarcaNormalizada[] = api.marcas
    .filter((m) => m && typeof m.id === 'number')
    .map((m) => ({
      id: m.id,
      nombre: texto(m.nombre),
      nombreErp: typeof m.nombre === 'string' ? m.nombre : '',
      logo: leerImagen(m.logo),
      cantidadProductos: num(m.productos),
    }))

  const generado = typeof api.generado === 'string' ? new Date(api.generado) : null
  return {
    generado: generado && !Number.isNaN(generado.getTime()) ? generado : null,
    sucursales: api.sucursales.map((s) => ({ id: s.id, nombre: texto(s.nombre) })),
    listas: api.listas.map((l) => ({ id: l.id, nombre: texto(l.nombre), modalidad: texto(l.modalidad), orden: num(l.orden) })),
    marcas,
    productos,
    descartados,
  }
}
