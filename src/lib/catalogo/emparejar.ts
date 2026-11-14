// Fotos en lote: a qué producto va cada archivo según su nombre.
// Se prueba en orden: código de barras (del producto, de sus fraccionados o DUN) → código interno → ID.
// Así Lucas puede nombrar las fotos como le quede más cómodo.

export type ProductoParaEmparejar = { id: number; codigo: string; codigosBarras: string[] }
export type Criterio = 'código de barras' | 'código' | 'ID'
export type Emparejado =
  | { archivo: string; clave: string; estado: 'ok'; productoId: number; por: Criterio }
  | { archivo: string; clave: string; estado: 'repetido'; productoId: number; por: Criterio }
  | { archivo: string; clave: string; estado: 'ambiguo'; candidatos: number[]; por: Criterio }
  | { archivo: string; clave: string; estado: 'sin-coincidencia' }

export const EXTENSIONES = /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?)$/i

/** «7790387015317 (1).jpg» → «7790387015317»; «arc006_2.JPG» → «arc006» */
export function claveDelArchivo(nombre: string): string {
  let base = nombre.split(/[\\/]/).pop() ?? nombre
  base = base.replace(EXTENSIONES, '').trim()
  const sinCopia = base.replace(/\s*\(\d+\)$/, '').replace(/[_ ]\d{1,2}$/, '').trim()
  return (sinCopia || base).toLowerCase()
}

export function armarIndice(productos: ProductoParaEmparejar[]) {
  const agregar = (m: Map<string, number[]>, k: string, id: number) => {
    if (!k) return
    const lista = m.get(k) ?? []
    if (!lista.includes(id)) lista.push(id)
    m.set(k, lista)
  }
  const barras = new Map<string, number[]>()
  const codigos = new Map<string, number[]>()
  const ids = new Set<number>()
  for (const p of productos) {
    ids.add(p.id)
    for (const b of p.codigosBarras) agregar(barras, b.trim().toLowerCase(), p.id)
    agregar(codigos, p.codigo.trim().toLowerCase(), p.id)
  }
  return { barras, codigos, ids }
}

export function emparejar(archivos: string[], indice: ReturnType<typeof armarIndice>): Emparejado[] {
  const usados = new Set<number>()
  return archivos.map((archivo): Emparejado => {
    const clave = claveDelArchivo(archivo)
    const intentos: [Criterio, number[] | undefined][] = [
      ['código de barras', indice.barras.get(clave)],
      ['código', indice.codigos.get(clave)],
      ['ID', /^\d+$/.test(clave) && indice.ids.has(Number(clave)) ? [Number(clave)] : undefined],
    ]
    for (const [por, candidatos] of intentos) {
      if (!candidatos?.length) continue
      if (candidatos.length > 1) return { archivo, clave, estado: 'ambiguo', candidatos, por }
      const productoId = candidatos[0]
      if (usados.has(productoId)) return { archivo, clave, estado: 'repetido', productoId, por }
      usados.add(productoId)
      return { archivo, clave, estado: 'ok', productoId, por }
    }
    return { archivo, clave, estado: 'sin-coincidencia' }
  })
}
