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
