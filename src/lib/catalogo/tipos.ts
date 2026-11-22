// Forma de la respuesta de GET /api/catalogo-externo (relevada el 14/11/2026).

export type PrecioApi = {
  listaId: number
  lista: string
  modalidad: string
  precio: number
  unidades: number
  precioFormato: number
  unidadesMinimas: number
  codigoBarras: string
}

export type PresentacionApi = {
  id: number
  tamano: string
  kg: number
  codigoBarras: string
  precios: PrecioApi[]
  stock: Record<string, number>
}

export type ProductoApi = {
  id: number
  nombre: string
  descripcion: string
  codigo: string
  codigoBarras: string
  dun: string
  marcaId: number | null
  marca: string
  categoria: string
  subcategoria: string
  etiquetas: string[]
  tipo: string
  unidad: string
  estado: string
  iva: number
  imagen: string
  precios: PrecioApi[]
  stock: Record<string, number>
  presentaciones: PresentacionApi[]
}

export type CatalogoApi = {
  generado: string
  cantidad: number
  sucursales: { id: number; nombre: string }[]
  listas: { id: number; nombre: string; modalidad: string; orden: number }[]
  marcas: { id: number; nombre: string; logo: string; productos: number }[]
  productos: ProductoApi[]
}

// ---- Ya normalizado, listo para guardar ----
// El stock va aparte (columnas productos.stock y stock_total): no forma parte del producto normalizado ni de su huella.

export type Precio = {
  listaId: number
  modalidad: string
  precio: number
  unidades: number
  precioFormato: number
  unidadesMinimas: number
  codigoBarras: string
}

export type Presentacion = {
  id: number
  tamano: string
  kg: number
  codigoBarras: string
  precios: Precio[]
}

export type ProductoNormalizado = {
  id: number
  nombre: string
  nombreErp: string
  nombreSugerido: string
  descripcion: string
  codigo: string
  codigoBarras: string
  dun: string
  marcaId: number | null
  categoria: string | null
  subcategoria: string | null
  etiquetas: string[]
  tipo: 'entero' | 'granel'
  unidad: string
  estado: string
  iva: number
  imagen: { url: string; version: string } | null
  precios: Precio[]
  presentaciones: Presentacion[]
}

export type MarcaNormalizada = {
  id: number
  nombre: string
  nombreErp: string
  logo: { url: string; version: string } | null
  cantidadProductos: number
}

export type CatalogoNormalizado = {
  generado: Date | null
  sucursales: { id: number; nombre: string }[]
  listas: { id: number; nombre: string; modalidad: string; orden: number }[]
  marcas: MarcaNormalizada[]
  productos: ProductoNormalizado[]
}
