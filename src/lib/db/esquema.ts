import { pgTable, bigserial, bigint, text, timestamp, boolean, index, integer, jsonb, numeric, uniqueIndex, serial } from 'drizzle-orm/pg-core'
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
    // Stock por sucursal (granel: el suyo más los fraccionados en kilos) y la suma de las 4. Se actualiza en cada sincronización.
    stock: jsonb('stock').$type<Record<string, number>>().notNull().default({}),
    stockTotal: numeric('stock_total', { precision: 14, scale: 2, mode: 'number' }).notNull().default(0),
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
  // Huella del HTML de las placas al exportar: si la pieza (o el catálogo) cambió, ya no coincide y hay que exportar de nuevo
  huella: text('huella'),
  // null = imágenes (placas JPEG); si no, el video que se armó: reel, historiaVideo o videoFeed
  formato: text('formato'),
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

export type FormatosPromo = { historia: boolean; feed: boolean; uno: boolean; reel?: boolean; historiaVideo?: boolean; videoFeed?: boolean }
// Cómo se anima una pieza en video (reel, historia en video, video de feed)
export type AnimacionPieza = { duracion: number; ritmo: 'suave' | 'dinamico'; variante: 'auto' | '1' | '2' | '3'; musicaId: number | null; portada: number }
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
  animacion: jsonb('animacion').$type<AnimacionPieza>(),
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
export type FormatosCarrusel = { carrusel: boolean; historia: boolean; reel: boolean; historiaVideo: boolean; videoFeed: boolean }
export const carruseles = pgTable('carruseles', {
  id: serial('id').primaryKey(),
  estilo: text('estilo').$type<EstiloCarrusel>().notNull(),
  titulo: text('titulo').notNull(),
  listaId: integer('lista_id').notNull().default(3),
  datos: jsonb('datos').$type<Record<string, unknown>>().notNull(),
  // Texto del posteo editado a mano (null = se arma solo)
  textoPosteo: text('texto_posteo'),
  // Un contenido, varios formatos: carrusel, historia (imagen), reel, historia en video y video de feed
  formatos: jsonb('formatos').$type<FormatosCarrusel>(),
  animacion: jsonb('animacion').$type<AnimacionPieza>(),
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

// ---------------------------------------------------------------------------
// Publicaciones (etapa 5): cada vez que Lucas aprueba publicar una pieza (ahora o programada).
// Cada destino (Instagram feed, Instagram historia, Facebook…) lleva su propio estado,
// así un reintento solo repite lo que falló y nunca publica dos veces lo que ya salió.
// ---------------------------------------------------------------------------
export type EstadoPublicacion = 'programada' | 'publicando' | 'reintentando' | 'publicada' | 'parcial' | 'error' | 'cancelada'
export type EstadoDestino = 'pendiente' | 'publicando' | 'ok' | 'error' | 'cancelado'
export type RedSocial = 'instagram' | 'facebook'
export type UbicacionDestino = 'feed' | 'historia' | 'reel'

export const publicaciones = pgTable(
  'publicaciones',
  {
    id: serial('id').primaryKey(),
    tipo: text('tipo').$type<'carrusel' | 'promo' | 'video'>().notNull(),
    referenciaId: integer('referencia_id').notNull(),
    titulo: text('titulo').notNull(),
    texto: text('texto').notNull().default(''),
    textoAlt: text('texto_alt'),
    // imagenes (carrusel e historias) o un video: reel, historiaVideo, videoFeed
    formato: text('formato').notNull().default('imagenes'),
    // Opciones del video: el reel también sale en el feed de Instagram
    opciones: jsonb('opciones').$type<{ compartirFeed?: boolean }>(),
    // Las imágenes salen de esta exportación (si estaba al día se reusa; si no, se arma una nueva al aprobar)
    exportacionId: integer('exportacion_id').references(() => exportaciones.id, { onDelete: 'set null' }),
    programadaPara: timestamp('programada_para', { withTimezone: true }).notNull(),
    // Próximo reintento (si Meta falló y quedan reintentos)
    proximoIntento: timestamp('proximo_intento', { withTimezone: true }),
    intentos: integer('intentos').notNull().default(0),
    estado: text('estado').$type<EstadoPublicacion>().notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    terminadoEn: timestamp('terminado_en', { withTimezone: true }),
  },
  (t) => [index('publicaciones_estado').on(t.estado, t.programadaPara), index('publicaciones_pieza').on(t.tipo, t.referenciaId)],
)

export const publicacionDestinos = pgTable(
  'publicacion_destinos',
  {
    id: serial('id').primaryKey(),
    publicacionId: integer('publicacion_id').notNull().references(() => publicaciones.id, { onDelete: 'cascade' }),
    red: text('red').$type<RedSocial>().notNull(),
    ubicacion: text('ubicacion').$type<UbicacionDestino>().notNull(),
    // Qué placas de la exportación van (posiciones, empezando en 0), en orden
    placas: jsonb('placas').$type<number[]>().notNull(),
    estado: text('estado').$type<EstadoDestino>().notNull().default('pendiente'),
    error: text('error'),
    // Id de lo publicado en Meta y su enlace
    metaId: text('meta_id'),
    enlace: text('enlace'),
    publicadoEn: timestamp('publicado_en', { withTimezone: true }),
  },
  (t) => [index('publicacion_destinos_pub').on(t.publicacionId)],
)

// ---------------------------------------------------------------------------
// Pautas en Meta (etapa 6): promocionar un posteo ya publicado. El presupuesto es siempre total,
// con fecha de fin: Meta nunca gasta más de lo que Lucas confirmó.
// ---------------------------------------------------------------------------
export type EstadoPauta = 'creando' | 'en_revision' | 'programada' | 'activa' | 'pausada' | 'con_problemas' | 'rechazada' | 'terminada' | 'error'
export type ResultadosPauta = { alcance: number; impresiones: number; clics: number; mensajes: number }

export const pautas = pgTable(
  'pautas',
  {
    id: serial('id').primaryKey(),
    publicacionId: integer('publicacion_id').references(() => publicaciones.id, { onDelete: 'set null' }),
    titulo: text('titulo').notNull(),
    objetivo: text('objetivo').notNull(), // mensajes, trafico, alcance
    publicoNombre: text('publico_nombre').notNull(),
    // Copia del público y de las ubicaciones al momento de lanzar
    publico: jsonb('publico').$type<Record<string, unknown>>().notNull(),
    ubicaciones: text('ubicaciones').notNull(),
    // De qué red sale el anuncio (el posteo de Instagram o el de Facebook)
    origen: text('origen').$type<'instagram' | 'facebook'>().notNull(),
    porDia: numeric('por_dia', { precision: 14, scale: 2, mode: 'number' }).notNull(),
    desde: text('desde').notNull(), // AAAA-MM-DD (Formosa)
    hasta: text('hasta').notNull(),
    total: numeric('total', { precision: 14, scale: 2, mode: 'number' }).notNull(), // lo máximo que puede gastar (sin impuestos)
    // Mes al que se carga en el tope (AAAA-MM, el de su inicio)
    mes: text('mes').notNull(),
    estado: text('estado').$type<EstadoPauta>().notNull(),
    motivo: text('motivo'),
    metaCampana: text('meta_campana'),
    metaConjunto: text('meta_conjunto'),
    metaCreativo: text('meta_creativo'),
    metaAnuncio: text('meta_anuncio'),
    gastado: numeric('gastado', { precision: 14, scale: 2, mode: 'number' }).notNull().default(0),
    resultados: jsonb('resultados').$type<ResultadosPauta>(),
    sincronizadoEn: timestamp('sincronizado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    terminadoEn: timestamp('terminado_en', { withTimezone: true }),
  },
  (t) => [index('pautas_estado').on(t.estado), index('pautas_mes').on(t.mes)],
)

// ---------------------------------------------------------------------------
// Biblioteca de música para los videos (temas libres de derechos que sube Lucas)
// ---------------------------------------------------------------------------
export const musica = pgTable('musica', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  archivo: text('archivo').notNull(), // ruta dentro de MEDIA_DIR
  duracion: numeric('duracion', { precision: 8, scale: 2, mode: 'number' }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Videos propios (Creación, fase 2): Lucas sube sus videos y les pone la marca encima.
// «videos» es la biblioteca (Mis videos); «piezas_video» es cada video armado con la marca.
// ---------------------------------------------------------------------------
export type EstadoVideoSubido = 'subiendo' | 'procesando' | 'listo' | 'error'

export const videos = pgTable(
  'videos',
  {
    id: serial('id').primaryKey(),
    nombre: text('nombre').notNull(),
    // La copia comprimida (1080p, H.264) y su miniatura, dentro de MEDIA_DIR. El original se borra al terminar.
    archivo: text('archivo'),
    miniatura: text('miniatura'),
    // Mientras sube: el archivo a medias (fuera de lo que sirve /media) y cuánto llegó
    temporal: text('temporal'),
    tamano: bigint('tamano', { mode: 'number' }).notNull().default(0),
    recibido: bigint('recibido', { mode: 'number' }).notNull().default(0),
    duracion: numeric('duracion', { precision: 8, scale: 2, mode: 'number' }),
    ancho: integer('ancho'),
    alto: integer('alto'),
    conAudio: boolean('con_audio').notNull().default(false),
    estado: text('estado').$type<EstadoVideoSubido>().notNull(),
    avance: integer('avance').notNull().default(0),
    error: text('error'),
    // Productos que aparecen (para buscar y para sugerir las franjas)
    productos: jsonb('productos').$type<number[]>().notNull().default([]),
    // Conservar: no se borra aunque no se use
    conservar: boolean('conservar').notNull().default(false),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    // La última vez que se usó en una pieza (la limpieza cuenta los 90 días desde acá o desde que se subió)
    usadoEn: timestamp('usado_en', { withTimezone: true }),
  },
  (t) => [index('videos_estado').on(t.estado)],
)

export type ClipVideo = { videoId: number; desde: number; hasta: number }
export type ProductoEnVideo = { id: number; desde: number; hasta: number; descuento: number; sello: boolean; presentacion: string | null }
export type TextoEnVideo = { texto: string; desde: number; hasta: number }
export type ContenidoVideo = {
  clips: ClipVideo[]
  // Video que no tiene la forma del formato: con el mismo video desenfocado de fondo, o recortado al centro
  encuadre: 'desenfoque' | 'recorte'
  sonido: { modo: 'original' | 'musica' | 'ambos'; musicaId: number | null }
  estilo: 'nutriofertas' | 'recetas' | 'lanzamiento' | 'promo'
  apertura: { activa: boolean; kicker: string; titulo: string }
  cierre: { activa: boolean; titulo: string; bajada: string }
  listaId: number
  // Los segundos de productos y textos cuentan desde el comienzo de los clips (sin la apertura)
  productos: ProductoEnVideo[]
  textos: TextoEnVideo[]
  // Segundo del video terminado que se usa de portada del reel
  portada: number
}
export type FormatosVideoPropio = { reel: boolean; historiaVideo: boolean; videoFeed: boolean }

export const piezasVideo = pgTable('piezas_video', {
  id: serial('id').primaryKey(),
  titulo: text('titulo').notNull(),
  contenido: jsonb('contenido').$type<ContenidoVideo>().notNull(),
  formatos: jsonb('formatos').$type<FormatosVideoPropio>().notNull(),
  // Texto del posteo editado a mano (null = se arma solo)
  textoPosteo: text('texto_posteo'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})
