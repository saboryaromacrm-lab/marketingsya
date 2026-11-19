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
