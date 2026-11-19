import { pgTable, bigserial, text, timestamp, boolean, index, integer, jsonb, numeric, uniqueIndex, serial } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { ProductoNormalizado } from '@/lib/catalogo/tipos'

// Precio principal de un producto en cada lista (clave: id de lista). Ver precioDeLista().
export type PreciosPorLista = Record<string, { precio: number; unidades: number; presentacion: string | null }>

// Cada intento de ingreso queda registrado: sirve para frenar a quien prueba
// contraseñas al azar y para que Lucas vea desde dónde se entró.
export const intentosIngreso = pgTable(
  'intentos_ingreso',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ip: text('ip').notNull(),
    exitoso: boolean('exitoso').notNull(),
    navegador: text('navegador'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('intentos_ingreso_ip_fecha').on(t.ip, t.creadoEn)],
)

// ---------------------------------------------------------------------------
// Catálogo: copia del ERP. Se escribe solo desde la sincronización.
// ---------------------------------------------------------------------------

export const sucursales = pgTable('sucursales', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull(),
})

export const listas = pgTable('listas', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull(),
  modalidad: text('modalidad').notNull(),
  orden: integer('orden').notNull().default(0),
})

export const marcas = pgTable('marcas', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull(),
  nombreErp: text('nombre_erp').notNull(),
  logoErpUrl: text('logo_erp_url'),
  logoErpVersion: text('logo_erp_version'),
  // Ruta dentro de MEDIA_DIR del logo copiado a nuestro servidor
  logoArchivo: text('logo_archivo'),
  cantidadProductos: integer('cantidad_productos').notNull().default(0),
  huella: text('huella').notNull(),
  dadaDeBaja: boolean('dada_de_baja').notNull().default(false),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

export const productos = pgTable(
  'productos',
  {
    id: integer('id').primaryKey(),
    nombre: text('nombre').notNull(),
    nombreErp: text('nombre_erp').notNull(),
    nombreSugerido: text('nombre_sugerido').notNull(),
    // Lo carga Lucas a mano; si está vacío, las piezas usan el sugerido.
    nombrePiezas: text('nombre_piezas'),
    // Frase corta para las piezas («Ideal para tus desayunos»): se guarda al usarla en un carrusel
    frasePiezas: text('frase_piezas'),
    marcaId: integer('marca_id').references(() => marcas.id),
    categoria: text('categoria'),
    subcategoria: text('subcategoria'),
    etiquetas: text('etiquetas').array().notNull().default(sql`'{}'::text[]`),
    tipo: text('tipo').notNull(),
    estado: text('estado').notNull(),
    codigo: text('codigo').notNull().default(''),
    codigoBarras: text('codigo_barras').notNull().default(''),
    // Precio minorista principal (en granel, el fraccionado de 1 kg): para ordenar y mostrar rápido.
    precioMinorista: numeric('precio_minorista', { precision: 14, scale: 2, mode: 'number' }),
    // Todo lo que vino del ERP ya normalizado: precios, fraccionados, descripción, etc.
    preciosLista: jsonb('precios_lista').$type<PreciosPorLista>().notNull().default({}),
    // Nombre, marca, categoría, etiquetas y códigos en minúscula y sin tildes. Ver busqueda.ts.
    busqueda: text('busqueda').notNull().default(''),
    erp: jsonb('erp').$type<ProductoNormalizado>().notNull(),
    huella: text('huella').notNull(),
    imagenErpVersion: text('imagen_erp_version'),
    imagenArchivo: text('imagen_archivo'),
    // Foto subida por Lucas: gana sobre la del ERP. Se guardan dos versiones:
    // la original achicada (hasta 1600 px) y una cuadrada con fondo blanco para las piezas.
    imagenPropiaArchivo: text('imagen_propia_archivo'),
    imagenPropiaCuadrada: text('imagen_propia_cuadrada'),
    imagenPropiaEn: timestamp('imagen_propia_en', { withTimezone: true }),
    // Lucas lo saca de las piezas (gaseosas, golosinas comunes): el motor de carruseles lo saltea.
    excluirDePiezas: boolean('excluir_de_piezas').notNull().default(false),
    dadoDeBaja: boolean('dado_de_baja').notNull().default(false),
    bajaEn: timestamp('baja_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('productos_marca').on(t.marcaId),
    index('productos_categoria').on(t.categoria, t.subcategoria),
    index('productos_busqueda').using('gin', sql`${t.busqueda} gin_trgm_ops`),
  ],
)

// ---------------------------------------------------------------------------
// Sincronizaciones: una fila por cada vez que se apretó el botón.
// ---------------------------------------------------------------------------

export type EstadoSincronizacion = 'en_cola' | 'corriendo' | 'ok' | 'sin_cambios' | 'error'

export type ResumenSincronizacion = {
  productos: number
  altas: number
  bajas: number
  reactivados: number
  modificados: number
  precios: number
  fotos: number
  fotosDescargadas: number
  fotosConError: number
  marcas: number
  descartados: number
}

export const sincronizaciones = pgTable(
  'sincronizaciones',
  {
    id: serial('id').primaryKey(),
    estado: text('estado').$type<EstadoSincronizacion>().notNull(),
    // Qué está haciendo y cuánto le falta (0 a 100), para la barra de avance
    etapa: text('etapa'),
    avance: integer('avance').notNull().default(0),
    etag: text('etag'),
    generadoErp: timestamp('generado_erp', { withTimezone: true }),
    resumen: jsonb('resumen').$type<ResumenSincronizacion>(),
    error: text('error'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    iniciadaEn: timestamp('iniciada_en', { withTimezone: true }),
    terminadaEn: timestamp('terminada_en', { withTimezone: true }),
  },
  // Nunca dos sincronizaciones a la vez: solo puede haber una fila en cola o corriendo.
  (t) => [uniqueIndex('una_sincronizacion_activa').on(sql`(true)`).where(sql`${t.estado} in ('en_cola', 'corriendo')`)],
)

export const sincronizacionCambios = pgTable(
  'sincronizacion_cambios',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sincronizacionId: integer('sincronizacion_id').notNull().references(() => sincronizaciones.id, { onDelete: 'cascade' }),
    entidad: text('entidad').$type<'producto' | 'marca'>().notNull(),
    entidadId: integer('entidad_id').notNull(),
    // Nombre al momento del cambio, para leer el historial aunque después cambie
    nombre: text('nombre').notNull(),
    tipo: text('tipo').notNull(),
    antes: jsonb('antes'),
    despues: jsonb('despues'),
  },
  (t) => [index('cambios_por_sincronizacion').on(t.sincronizacionId, t.tipo)],
)

// ---------------------------------------------------------------------------
// Ajustes guardados en la base (contraseña, secreto de sesión, logo).
// Así Lucas no tiene que tocar variables de entorno para lo de todos los días.
// ---------------------------------------------------------------------------

export const ajustes = pgTable('ajustes', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Exportaciones: cada vez que se pasan placas a JPEG (un carrusel, o la prueba del motor).
// ---------------------------------------------------------------------------

export type EstadoExportacion = 'en_cola' | 'corriendo' | 'ok' | 'error'

export const exportaciones = pgTable('exportaciones', {
  id: serial('id').primaryKey(),
  // «prueba» (diagnóstico del motor) o «carrusel»
  tipo: text('tipo').notNull(),
  referenciaId: integer('referencia_id'),
  // Direcciones de las placas a renderizar (rutas /render/...), en orden
  placas: jsonb('placas').$type<string[]>().notNull(),
  estado: text('estado').$type<EstadoExportacion>().notNull(),
  avance: integer('avance').notNull().default(0),
  // JPEG resultantes y el .zip, como rutas dentro de MEDIA_DIR
  archivos: jsonb('archivos').$type<string[]>().notNull().default([]),
  zip: text('zip'),
  error: text('error'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  terminadoEn: timestamp('terminado_en', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// Selección del catálogo: los productos marcados con las casillas (sirve para armar promos y carruseles).
// Se guarda en la base: no se pierde al cambiar de página, filtrar o pasar de la computadora al celular.
// ---------------------------------------------------------------------------

export const seleccion = pgTable('seleccion', {
  productoId: integer('producto_id').primaryKey().references(() => productos.id, { onDelete: 'cascade' }),
  agregadoEn: timestamp('agregado_en', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Promos (flyer de promociones). Solo diseñan: nunca tocan precios en el ERP.
// ---------------------------------------------------------------------------

export type FormatosPromo = { historia: boolean; feed: boolean; uno: boolean }
export type DisenoPromo = '1' | '2'

export const promos = pgTable('promos', {
  id: serial('id').primaryKey(),
  titulo: text('titulo').notNull().default('PROMOCIONES'),
  desde: text('desde').notNull(), // AAAA-MM-DD (fecha de Formosa)
  hasta: text('hasta').notNull(),
  listaId: integer('lista_id').notNull().default(3),
  diseno: text('diseno').$type<DisenoPromo>().notNull().default('1'),
  formatos: jsonb('formatos').$type<FormatosPromo>().notNull().default({ historia: true, feed: true, uno: false }),
  // Última exportación (para descargar de nuevo desde el historial)
  exportacionId: integer('exportacion_id'),
  // Texto del posteo editado a mano (null = se arma solo)
  textoPosteo: text('texto_posteo'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

export type TipoFila = 'producto' | 'variantes' | 'grupo'
// Un producto dentro de una fila. Nombre y tamaño cortos opcionales (si no, se calculan solos);
// presentación: para granel, qué fraccionado se muestra (null = el precio por kilo o el de 1 kg).
export type ItemFila = { id: number; nombre?: string | null; tam?: string | null; presentacion?: string | null }

export const promoFilas = pgTable(
  'promo_filas',
  {
    id: serial('id').primaryKey(),
    promoId: integer('promo_id').notNull().references(() => promos.id, { onDelete: 'cascade' }),
    orden: integer('orden').notNull(),
    tipo: text('tipo').$type<TipoFila>().notNull(),
    // Título de la fila (grupos y variantes; en un producto, reemplaza al nombre para piezas)
    titulo: text('titulo'),
    descuento: numeric('descuento', { precision: 5, scale: 2, mode: 'number' }),
    cantidadMinima: integer('cantidad_minima'),
    // Promos que vienen del ERP (lista Promo): precio por unidad fijo, en lugar de un %
    precioFijo: numeric('precio_fijo', { precision: 14, scale: 2, mode: 'number' }),
    origen: text('origen').$type<'manual' | 'erp'>().notNull().default('manual'),
    productos: jsonb('productos').$type<ItemFila[]>().notNull(),
  },
  (t) => [index('promo_filas_promo').on(t.promoId, t.orden)],
)

// ---------------------------------------------------------------------------
// Carruseles (etapa 2): los 3 estilos aprobados. El contenido de cada estilo va en `datos`
// (ver src/lib/carruseles/tipos.ts); los productos se guardan por id y se leen del catálogo al dibujar.
// ---------------------------------------------------------------------------
export type EstiloCarrusel = 'lanzamiento' | 'nutriofertas' | 'recetas'
export const carruseles = pgTable('carruseles', {
  id: serial('id').primaryKey(),
  estilo: text('estilo').$type<EstiloCarrusel>().notNull(),
  titulo: text('titulo').notNull(),
  listaId: integer('lista_id').notNull().default(3),
  datos: jsonb('datos').$type<Record<string, unknown>>().notNull(),
  // Texto del posteo editado a mano (null = se arma solo)
  textoPosteo: text('texto_posteo'),
  exportacionId: integer('exportacion_id'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Asesor con IA (etapa 4): cada pedido a Claude queda registrado con su costo, para el contador
// y el corte al llegar al tope del mes.
// ---------------------------------------------------------------------------
export const iaConsumos = pgTable(
  'ia_consumos',
  {
    id: serial('id').primaryKey(),
    tipo: text('tipo').notNull(), // sugerencias, semana, receta, texto, chat
    modelo: text('modelo').notNull(),
    entrada: integer('entrada').notNull(),
    salida: integer('salida').notNull(),
    cacheLectura: integer('cache_lectura').notNull().default(0),
    cacheEscritura: integer('cache_escritura').notNull().default(0),
    costo: numeric('costo', { precision: 12, scale: 6, mode: 'number' }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ia_consumos_fecha').on(t.creadoEn)],
)

// Lo último que propuso la IA (sugerencias, y el calendario de cada semana), para no volver a pagar por verlo
export const iaIdeas = pgTable(
  'ia_ideas',
  {
    id: serial('id').primaryKey(),
    tipo: text('tipo').$type<'sugerencias' | 'semana'>().notNull(),
    clave: text('clave').notNull(), // «ultima» o el lunes de la semana (AAAA-MM-DD)
    datos: jsonb('datos').$type<Record<string, unknown>>().notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ia_ideas_tipo_clave').on(t.tipo, t.clave)],
)

export const iaChat = pgTable('ia_chat', {
  id: serial('id').primaryKey(),
  rol: text('rol').$type<'user' | 'assistant'>().notNull(),
  texto: text('texto').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})
