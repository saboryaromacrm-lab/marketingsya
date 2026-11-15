// Compara la versión guardada de un producto con la que llega del ERP
// y describe qué cambió, para el historial de sincronizaciones.

import { createHash } from 'node:crypto'
import type { MarcaNormalizada, ProductoNormalizado } from './tipos'

export type TipoCambio =
  | 'alta' | 'baja' | 'reactivado'
  | 'nombre' | 'marca' | 'categoria' | 'etiquetas' | 'estado' | 'precio' | 'foto' | 'fraccionados' | 'datos'

export type Cambio = { tipo: TipoCambio; antes: unknown; despues: unknown }

// Huella: si no cambió, el producto no se toca.
// No incluye el nombre sugerido: si mejoran las reglas, no cuenta como cambio del ERP.
export function huella(p: ProductoNormalizado | MarcaNormalizada): string {
  const { nombreSugerido: _ns, ...resto } = p as ProductoNormalizado
  return createHash('sha1').update(JSON.stringify(resto)).digest('base64url')
}

const iguales = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// «Minorista», «Mayorista x12», «Minorista · 500 g»
function tablaDePrecios(p: ProductoNormalizado, listas: Map<number, string>): Record<string, number> {
  const tabla: Record<string, number> = {}
  const nombre = (id: number, modalidad: string) => listas.get(id) ?? modalidad ?? `Lista ${id}`
  for (const x of p.precios) tabla[`${nombre(x.listaId, x.modalidad)}${x.unidades !== 1 ? ` x${x.unidades}` : ''}`] = x.precio
  for (const pr of p.presentaciones) {
    for (const x of pr.precios) tabla[`${nombre(x.listaId, x.modalidad)}${x.unidades !== 1 ? ` x${x.unidades}` : ''} · ${pr.tamano}`] = x.precio
  }
  return tabla
}

export function compararProducto(antes: ProductoNormalizado, despues: ProductoNormalizado, listas: Map<number, string>): Cambio[] {
  const cambios: Cambio[] = []
  const si = (tipo: TipoCambio, a: unknown, d: unknown) => {
    if (!iguales(a, d)) cambios.push({ tipo, antes: a, despues: d })
  }
  si('nombre', antes.nombre, despues.nombre)
  si('marca', antes.marcaId, despues.marcaId)
  si('categoria', [antes.categoria, antes.subcategoria].filter(Boolean).join(' › '), [despues.categoria, despues.subcategoria].filter(Boolean).join(' › '))
  si('etiquetas', antes.etiquetas, despues.etiquetas)
  si('estado', antes.estado, despues.estado)
  si('foto', antes.imagen?.version ?? null, despues.imagen?.version ?? null)
  si('fraccionados', antes.presentaciones.map((p) => p.tamano), despues.presentaciones.map((p) => p.tamano))

  // Precios: solo las filas que cambiaron, aparecieron o desaparecieron.
  const pa = tablaDePrecios(antes, listas)
  const pd = tablaDePrecios(despues, listas)
  const a: Record<string, number | null> = {}
  const d: Record<string, number | null> = {}
  for (const k of new Set([...Object.keys(pa), ...Object.keys(pd)])) {
    if (pa[k] !== pd[k]) {
      a[k] = pa[k] ?? null
      d[k] = pd[k] ?? null
    }
  }
  if (Object.keys(a).length) cambios.push({ tipo: 'precio', antes: a, despues: d })

  const otros = (p: ProductoNormalizado) => ({ codigo: p.codigo, codigoBarras: p.codigoBarras, dun: p.dun, descripcion: p.descripcion, tipo: p.tipo, unidad: p.unidad, iva: p.iva })
  si('datos', otros(antes), otros(despues))
  return cambios
}
