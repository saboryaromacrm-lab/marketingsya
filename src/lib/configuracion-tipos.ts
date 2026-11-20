// Todo lo que Lucas puede ajustar desde Configuración, con sus valores de entrada.
// Puro (sin base): lo usan el servidor y las pantallas.

export const MODELOS_IA = {
  'claude-opus-5-5': { nombre: 'Claude Opus 5.5', detalle: 'el más capaz · recomendado' },
  'claude-sonnet-5-5': { nombre: 'Claude Sonnet 5.5', detalle: 'mitad de precio' },
  'claude-haiku-5-5': { nombre: 'Claude Haiku 5.5', detalle: 'el más barato, escribe y razona peor' },
} as const
export type ModeloIA = keyof typeof MODELOS_IA

export const TIPOS_IDEA = {
  nutriofertas: 'Carrusel NutriOfertas',
  receta: 'Carrusel de receta',
  promo: 'Promo (historia y feed)',
  lanzamiento: 'Carrusel Lanzamiento',
  historia: 'Idea para historia',
} as const
export type TipoIdea = keyof typeof TIPOS_IDEA

export const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
export type Dia = (typeof DIAS)[number]
export const NOMBRE_DIA: Record<Dia, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' }

export type Config = {
  contacto: { web: string; whatsapp: string; instagram: string }
  piezas: { listaId: number; descuento: number; vigenciaDias: number; formatos: { historia: boolean; feed: boolean; uno: boolean } }
  ia: {
    modelo: ModeloIA
    profundidad: 'rapida' | 'normal' | 'fondo'
    topeTotal: number
    topeTexto: number
    avisoPct: number
    cortar: boolean
    tono: string
    emojis: 'ninguno' | 'pocos' | 'mas'
    hashtags: string[]
    slogans: string[]
    prohibidas: string[]
    calendario: Record<Dia, TipoIdea | 'nada'>
    fechasEspeciales: boolean
    criterios: { nuevos: boolean; bajaron: boolean; epoca: boolean; sinUsar: boolean; diasSinUsar: number }
    ideasPorVez: number
  }
  meta: {
    // Destinos marcados de entrada en «Publicar»
    destinos: { feed: { instagram: boolean; facebook: boolean }; historia: { instagram: boolean; facebook: boolean } }
    horaFeed: string // HH:MM, hora de Formosa
    horaHistoria: string
    reintentos: number // reintentos automáticos si Meta falla (cada 5 minutos)
    textoAlt: boolean
    // Dirección pública de la plataforma: Meta descarga las imágenes de ahí
    urlPublica: string
    versionApi: string
  }
  pautas: {
    topeMensual: number // en pesos, sin impuestos
    cortar: boolean
    porDia: number
    dias: number
    escribirDesde: number // desde este total hay que escribir el monto para confirmar
    iva: number // % aproximado que suma Meta
    objetivo: ObjetivoPauta
    ubicaciones: UbicacionesPauta
    utm: boolean
    publicos: PublicoPauta[]
    publicoEntrada: string
  }
}

// ---------------------------------------------------------------------------
// Pautas (etapa 6)
// ---------------------------------------------------------------------------
export const OBJETIVOS_PAUTA = {
  mensajes: { nombre: 'Mensajes por WhatsApp', detalle: 'Botón «Enviar mensaje» al WhatsApp. Mide cuántas conversaciones empiezan.', resultado: ['mensaje', 'mensajes'] },
  trafico: { nombre: 'Tráfico a la tienda online', detalle: 'Botón «Comprar» a la tienda online. Mide clics.', resultado: ['clic', 'clics'] },
  alcance: { nombre: 'Alcance', detalle: 'Que lo vea la mayor cantidad de gente de la zona. Mide personas alcanzadas.', resultado: ['persona', 'personas'] },
} as const
export type ObjetivoPauta = keyof typeof OBJETIVOS_PAUTA

export const UBICACIONES_PAUTA = {
  ig_fb: 'Instagram y Facebook (feed, historias y reels)',
  ig: 'Solo Instagram (feed, historias y reels)',
  fb: 'Solo Facebook (feed, historias y reels)',
} as const
export type UbicacionesPauta = keyof typeof UBICACIONES_PAUTA

export type ZonaPublico = { tipo: 'radio'; nombre: string; lat: number; lng: number; km: number } | { tipo: 'region'; nombre: string }
export type PublicoPauta = {
  id: string
  nombre: string
  zona: ZonaPublico
  edadMin: number
  edadMax: number // 65 = 65 o más
  generos: 'todos' | 'mujeres' | 'hombres'
  intereses: string[] // por nombre: se buscan en Meta al lanzar
  advantage: boolean // Meta amplía el público partiendo de esto (Advantage+)
}

/** Minutos entre un reintento y el siguiente cuando Meta falla. */
export const MINUTOS_ENTRE_REINTENTOS = 5

export const CONFIG_INICIAL: Config = {
  contacto: { web: 'tiendaonline.saboryaroma.com', whatsapp: '370 462-1563', instagram: '@saboryaroma__' },
  piezas: { listaId: 3, descuento: 10, vigenciaDias: 7, formatos: { historia: true, feed: true, uno: false } },
  ia: {
    modelo: 'claude-opus-5-5',
    profundidad: 'normal',
    topeTotal: 30,
    topeTexto: 20,
    avisoPct: 80,
    cortar: true,
    tono: 'Cercano y rioplatense, con voseo. Alegre pero sin exagerar. Hablamos de precios bajos que nutren y de comer rico y sano.',
    emojis: 'pocos',
    hashtags: ['#SaborYAroma', '#Formosa', '#VidaSana'],
    slogans: [
      'Distribuimos bienestar.', 'Lo que hace bien, conviene.', 'Donde lo saludable conviene.', 'Más natural. Más ahorro.',
      'Precios sanos. Productos reales.', 'Natural que rinde.', 'Calidad consciente.', 'Tu proveedor natural.',
      'Natural + Ahorro.', 'Natural siempre.', 'Elegí sano.',
    ],
    prohibidas: ['cura', 'adelgaza', 'previene enfermedades', 'milagroso'],
    calendario: { lunes: 'nutriofertas', martes: 'nada', miercoles: 'receta', jueves: 'nada', viernes: 'promo', sabado: 'nada', domingo: 'nada' },
    fechasEspeciales: true,
    criterios: { nuevos: true, bajaron: true, epoca: true, sinUsar: true, diasSinUsar: 30 },
    ideasPorVez: 8,
  },
  meta: {
    destinos: { feed: { instagram: true, facebook: true }, historia: { instagram: true, facebook: true } },
    horaFeed: '10:00',
    horaHistoria: '19:00',
    reintentos: 3,
    textoAlt: true,
    urlPublica: 'https://marketing.saboryaroma.com',
    versionApi: 'v24.0',
  },
  pautas: {
    topeMensual: 100000,
    cortar: true,
    porDia: 3000,
    dias: 7,
    escribirDesde: 50000,
    iva: 21,
    objetivo: 'mensajes',
    ubicaciones: 'ig_fb',
    utm: true,
    publicos: [
      { id: 'minorista', nombre: 'Minorista Formosa', zona: { tipo: 'radio', nombre: 'Formosa Capital', lat: -26.1775, lng: -58.1781, km: 15 }, edadMin: 18, edadMax: 65, generos: 'todos', intereses: ['Vida saludable', 'Alimentación saludable', 'Comida orgánica'], advantage: true },
      { id: 'mayoristas', nombre: 'Mayoristas provincia', zona: { tipo: 'region', nombre: 'Formosa' }, edadMin: 25, edadMax: 65, generos: 'todos', intereses: ['Comercio minorista', 'Pequeña empresa', 'Emprendimiento'], advantage: true },
    ],
    publicoEntrada: 'minorista',
  },
}

// ---------------------------------------------------------------------------
// Limpieza: lo guardado (o lo que llega de la pantalla) se mezcla con los valores de entrada,
// con el tipo y el rango correctos. Lo desconocido se descarta.
// ---------------------------------------------------------------------------
const texto = (v: unknown, def: string, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : def)
const numero = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : def
}
const booleano = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
const lista = (v: unknown, def: string[], maxItems = 40, maxLargo = 120) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, maxLargo)))].slice(0, maxItems) : def
const deLista = <T extends string>(v: unknown, opciones: readonly T[], def: T): T => (opciones.includes(v as T) ? (v as T) : def)
const hora = (v: unknown, def: string) => {
  const m = typeof v === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : def
}
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function limpiarConfig(valor: unknown): Config {
  const v = obj(valor)
  const c = obj(v.contacto), p = obj(v.piezas), ia = obj(v.ia), m = obj(v.meta)
  const md = obj(m.destinos), mf = obj(md.feed), mh = obj(md.historia)
  const pa = obj(v.pautas)
  const d = CONFIG_INICIAL
  const f = obj(p.formatos), cal = obj(ia.calendario), cr = obj(ia.criterios)
  const hashtags = lista(ia.hashtags, d.ia.hashtags, 15, 40).map((h) => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, ''))
  const topeTotal = numero(ia.topeTotal, d.ia.topeTotal, 0, 1000)
  return {
    contacto: {
      web: texto(c.web, d.contacto.web, 80).replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      whatsapp: texto(c.whatsapp, d.contacto.whatsapp, 30),
      instagram: (() => { const i = texto(c.instagram, d.contacto.instagram, 40).replace(/\s+/g, ''); return i.startsWith('@') ? i : `@${i}` })(),
    },
    piezas: {
      listaId: numero(p.listaId, d.piezas.listaId, 1, 100000),
      descuento: numero(p.descuento, d.piezas.descuento, 0, 90),
      vigenciaDias: numero(p.vigenciaDias, d.piezas.vigenciaDias, 0, 90),
      formatos: { historia: booleano(f.historia, d.piezas.formatos.historia), feed: booleano(f.feed, d.piezas.formatos.feed), uno: booleano(f.uno, d.piezas.formatos.uno) },
    },
    ia: {
      modelo: deLista(ia.modelo, Object.keys(MODELOS_IA) as ModeloIA[], d.ia.modelo),
      profundidad: deLista(ia.profundidad, ['rapida', 'normal', 'fondo'] as const, d.ia.profundidad),
      topeTotal,
      topeTexto: Math.min(topeTotal, numero(ia.topeTexto, d.ia.topeTexto, 0, 1000)),
      avisoPct: numero(ia.avisoPct, d.ia.avisoPct, 10, 100),
      cortar: booleano(ia.cortar, d.ia.cortar),
      tono: texto(ia.tono, d.ia.tono, 1000),
      emojis: deLista(ia.emojis, ['ninguno', 'pocos', 'mas'] as const, d.ia.emojis),
      hashtags,
      slogans: lista(ia.slogans, d.ia.slogans, 30, 80),
      prohibidas: lista(ia.prohibidas, d.ia.prohibidas, 40, 60),
      calendario: Object.fromEntries(DIAS.map((dia) => [dia, deLista(cal[dia], [...Object.keys(TIPOS_IDEA), 'nada'] as (TipoIdea | 'nada')[], d.ia.calendario[dia])])) as Record<Dia, TipoIdea | 'nada'>,
      fechasEspeciales: booleano(ia.fechasEspeciales, d.ia.fechasEspeciales),
      criterios: {
        nuevos: booleano(cr.nuevos, d.ia.criterios.nuevos),
        bajaron: booleano(cr.bajaron, d.ia.criterios.bajaron),
        epoca: booleano(cr.epoca, d.ia.criterios.epoca),
        sinUsar: booleano(cr.sinUsar, d.ia.criterios.sinUsar),
        diasSinUsar: numero(cr.diasSinUsar, d.ia.criterios.diasSinUsar, 1, 365),
      },
      ideasPorVez: numero(ia.ideasPorVez, d.ia.ideasPorVez, 3, 20),
    },
    meta: {
      destinos: {
        feed: { instagram: booleano(mf.instagram, d.meta.destinos.feed.instagram), facebook: booleano(mf.facebook, d.meta.destinos.feed.facebook) },
        historia: { instagram: booleano(mh.instagram, d.meta.destinos.historia.instagram), facebook: booleano(mh.facebook, d.meta.destinos.historia.facebook) },
      },
      horaFeed: hora(m.horaFeed, d.meta.horaFeed),
      horaHistoria: hora(m.horaHistoria, d.meta.horaHistoria),
      reintentos: Math.round(numero(m.reintentos, d.meta.reintentos, 0, 5)),
      textoAlt: booleano(m.textoAlt, d.meta.textoAlt),
      urlPublica: (() => {
        const u = texto(m.urlPublica, d.meta.urlPublica, 120).replace(/\/+$/, '')
        const conEsquema = /^https?:\/\//.test(u) ? u : `https://${u}`
        try { return new URL(conEsquema).origin } catch { return d.meta.urlPublica }
      })(),
      versionApi: typeof m.versionApi === 'string' && /^v\d{1,2}\.\d$/.test(m.versionApi.trim()) ? m.versionApi.trim() : d.meta.versionApi,
    },
    pautas: (() => {
      const publicos = Array.isArray(pa.publicos) ? pa.publicos.map(limpiarPublico).filter((x): x is PublicoPauta => !!x).slice(0, 12) : d.pautas.publicos
      const lista = publicos.length ? publicos : d.pautas.publicos
      const entrada = typeof pa.publicoEntrada === 'string' && lista.some((x) => x.id === pa.publicoEntrada) ? pa.publicoEntrada : lista[0].id
      return {
        topeMensual: Math.round(numero(pa.topeMensual, d.pautas.topeMensual, 0, 100_000_000)),
        cortar: booleano(pa.cortar, d.pautas.cortar),
        porDia: Math.round(numero(pa.porDia, d.pautas.porDia, 100, 10_000_000)),
        dias: Math.round(numero(pa.dias, d.pautas.dias, 1, 90)),
        escribirDesde: Math.round(numero(pa.escribirDesde, d.pautas.escribirDesde, 0, 100_000_000)),
        iva: numero(pa.iva, d.pautas.iva, 0, 100),
        objetivo: deLista(pa.objetivo, Object.keys(OBJETIVOS_PAUTA) as ObjetivoPauta[], d.pautas.objetivo),
        ubicaciones: deLista(pa.ubicaciones, Object.keys(UBICACIONES_PAUTA) as UbicacionesPauta[], d.pautas.ubicaciones),
        utm: booleano(pa.utm, d.pautas.utm),
        publicos: lista,
        publicoEntrada: entrada,
      }
    })(),
  }
}

/** Un público guardado, con sus límites (Meta exige que con Advantage+ la edad máxima quede en 65+ y la mínima hasta 25). */
export function limpiarPublico(valor: unknown): PublicoPauta | null {
  const p = obj(valor), z = obj(p.zona)
  const nombre = texto(p.nombre, '', 40)
  if (!nombre) return null
  const zona: ZonaPublico | null =
    z.tipo === 'region'
      ? (texto(z.nombre, '', 60) ? { tipo: 'region', nombre: texto(z.nombre, '', 60) } : null)
      : Number.isFinite(Number(z.lat)) && Number.isFinite(Number(z.lng))
        ? { tipo: 'radio', nombre: texto(z.nombre, 'Zona', 60), lat: numero(z.lat, 0, -90, 90), lng: numero(z.lng, 0, -180, 180), km: Math.round(numero(z.km, 15, 1, 80)) }
        : null
  if (!zona) return null
  const advantage = booleano(p.advantage, true)
  let edadMin = Math.round(numero(p.edadMin, 18, 18, 65))
  let edadMax = Math.round(numero(p.edadMax, 65, 18, 65))
  if (edadMax < edadMin) edadMax = edadMin
  if (advantage) { edadMax = 65; edadMin = Math.min(edadMin, 25) }
  const id = typeof p.id === 'string' && /^[a-z0-9-]{1,40}$/.test(p.id) ? p.id : nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'publico'
  return {
    id, nombre, zona, edadMin, edadMax,
    generos: deLista(p.generos, ['todos', 'mujeres', 'hombres'] as const, 'todos'),
    intereses: lista(p.intereses, [], 10, 60),
    advantage,
  }
}

/** «tiendaonline.saboryaroma.com» → ['tiendaonline.', 'saboryaroma', '.com'] (la marca va resaltada en las placas). */
export function partirWeb(web: string): [string, string, string] {
  const p = web.split('.')
  if (p.length < 2) return ['', web, '']
  // «com.ar», «gob.ar»: la marca es la etiqueta anterior a esas dos
  const doble = p.length >= 3 && /^(com|net|org|gob|edu|tur)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2
  const i = p.length - (doble ? 3 : 2)
  return [p.slice(0, i).map((x) => `${x}.`).join(''), p[i], `.${p.slice(i + 1).join('.')}`]
}
