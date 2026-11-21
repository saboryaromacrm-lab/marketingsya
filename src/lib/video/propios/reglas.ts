// Reglas de los videos propios (los que sube Lucas y les ponemos la marca encima).
// Puras: sin base ni red. Las usan el servidor y la pantalla, y se prueban solas.

import type { ClipVideo, ContenidoVideo, FormatosVideoPropio, ProductoEnVideo, TextoEnVideo } from '@/lib/db/esquema'
import { FORMATOS_VIDEO, type FormatoVideo } from '../tipos'

export const MAX_SUBIDA = 300 * 1024 * 1024
export const MAX_DURACION_SUBIDA = 180
export const EXTENSIONES_VIDEO = ['mp4', 'mov', 'webm', 'm4v'] as const
// Cada pedazo de la subida (el servidor corta los pedidos en 25 MB)
export const PEDAZO = 8 * 1024 * 1024
export const MAX_CLIPS = 5
export const MAX_PRODUCTOS = 3
export const MAX_TEXTOS = 3
export const MAX_LETRAS_TEXTO = 40
// Corte suave entre clips y entre la apertura, los clips y el cierre
export const TRANSICION = 0.3
export const MIN_CLIP = 0.5
// Lo mínimo que se ve una franja o un texto
export const MIN_CAPA = 1
// Apertura y cierre: las escenas de portada y cierre de los reels animados (ritmo suave)
export const DUR_APERTURA = 2.4
export const DUR_CIERRE = 2.8
// Duración máxima del video terminado: la historia en video, hasta 60 s
export const MAX_TOTAL: Record<FormatoVideo, number> = { reel: 90, historiaVideo: 60, videoFeed: 90 }
// Limpieza: los videos que no se usan se borran a los 90 días (se avisa 14 días antes)
export const DIAS_LIMPIEZA = 90
export const DIAS_AVISO = 14
// La música, bajita debajo de la voz cuando van los dos
export const VOLUMEN_MUSICA_MEZCLA = 0.25

export const FORMATOS_PROPIO_INICIAL: FormatosVideoPropio = { reel: true, historiaVideo: false, videoFeed: false }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const num = (v: unknown, base: number) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : base
}
const decima = (n: number) => Math.round(n * 10) / 10
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export const esExtensionVideo = (nombre: string) => (EXTENSIONES_VIDEO as readonly string[]).includes((nombre.split('.').pop() ?? '').toLowerCase())

/** «0:07», «1:05». */
export function mmss(s: number): string {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** «0:07,5» para los segundos con decimales (los campos de los editores). */
export const segundos = (s: number) => s.toLocaleString('es-AR', { maximumFractionDigits: 1 })

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------
export function contenidoInicial(o: { clips: ClipVideo[]; productos?: number[]; estilo?: ContenidoVideo['estilo']; listaId?: number; titulo?: string }): ContenidoVideo {
  const medio = duracionMedio(o.clips)
  const prods = (o.productos ?? []).slice(0, MAX_PRODUCTOS)
  // Las franjas de los productos se reparten solas a lo largo de los clips
  const tramo = prods.length ? medio / prods.length : 0
  return {
    clips: o.clips,
    encuadre: 'desenfoque',
    sonido: { modo: 'original', musicaId: null },
    estilo: o.estilo ?? 'nutriofertas',
    apertura: { activa: true, kicker: '', titulo: o.titulo ?? '¡Mirá lo nuevo!' },
    cierre: { activa: true, titulo: 'Te esperamos', bajada: 'Pedí por WhatsApp o en la tienda online' },
    listaId: o.listaId ?? 3,
    productos: prods.map((id, i) => {
      const desde = decima(i * tramo + Math.min(0.6, tramo * 0.15))
      return { id, desde, hasta: decima(Math.max(desde + MIN_CAPA, (i + 1) * tramo - Math.min(0.4, tramo * 0.1))), descuento: 0, sello: false, presentacion: null }
    }),
    textos: [],
    portada: 0.8,
  }
}

/**
 * Deja el contenido válido. `duraciones`: lo que dura cada video de la biblioteca (los clips que no están se sacan).
 * Los segundos de franjas y textos se ajustan a lo que duran los clips.
 */
export function limpiarContenido(v: unknown, duraciones: Record<number, number>): ContenidoVideo {
  const c = obj(v)
  const clips: ClipVideo[] = (Array.isArray(c.clips) ? c.clips : [])
    .map((x) => {
      const o = obj(x)
      const videoId = Number(o.videoId)
      const dur = duraciones[videoId]
      if (!Number.isInteger(videoId) || !(dur > 0)) return null
      const desde = decima(Math.min(Math.max(0, num(o.desde, 0)), Math.max(0, dur - MIN_CLIP)))
      const hasta = decima(Math.min(dur, Math.max(desde + MIN_CLIP, num(o.hasta, dur))))
      return { videoId, desde, hasta }
    })
    .filter((x): x is ClipVideo => !!x)
    .slice(0, MAX_CLIPS)
  const medio = duracionMedio(clips)
  const enTramo = (o: Record<string, unknown>) => {
    const tope = Math.max(MIN_CAPA, medio)
    const desde = decima(Math.min(Math.max(0, num(o.desde, 0)), Math.max(0, tope - MIN_CAPA)))
    const hasta = decima(Math.min(tope, Math.max(desde + MIN_CAPA, num(o.hasta, desde + 3))))
    return { desde, hasta }
  }
  const s = obj(c.sonido)
  const a = obj(c.apertura)
  const ci = obj(c.cierre)
  const estilos = ['nutriofertas', 'recetas', 'lanzamiento', 'promo'] as const
  const vistos = new Set<number>()
  return {
    clips,
    encuadre: c.encuadre === 'recorte' ? 'recorte' : 'desenfoque',
    sonido: {
      modo: s.modo === 'musica' || s.modo === 'ambos' ? s.modo : 'original',
      musicaId: Number.isInteger(s.musicaId) && Number(s.musicaId) > 0 ? Number(s.musicaId) : null,
    },
    estilo: estilos.find((e) => e === c.estilo) ?? 'nutriofertas',
    apertura: { activa: a.activa !== false, kicker: texto(a.kicker, 30), titulo: texto(a.titulo, 50) },
    cierre: { activa: ci.activa !== false, titulo: texto(ci.titulo, 40) || 'Te esperamos', bajada: texto(ci.bajada, 70) },
    listaId: Number.isInteger(c.listaId) && Number(c.listaId) > 0 ? Number(c.listaId) : 3,
    productos: (Array.isArray(c.productos) ? c.productos : [])
      .map((x): ProductoEnVideo | null => {
        const o = obj(x)
        const id = Number(o.id)
        if (!Number.isInteger(id) || id <= 0 || vistos.has(id)) return null
        vistos.add(id)
        return { id, ...enTramo(o), descuento: Math.round(Math.min(90, Math.max(0, num(o.descuento, 0)))), sello: o.sello === true, presentacion: typeof o.presentacion === 'string' && o.presentacion ? o.presentacion.slice(0, 40) : null }
      })
      .filter((x): x is ProductoEnVideo => !!x)
      .slice(0, MAX_PRODUCTOS),
    textos: (Array.isArray(c.textos) ? c.textos : [])
      .map((x): TextoEnVideo => { const o = obj(x); return { texto: texto(o.texto, MAX_LETRAS_TEXTO), ...enTramo(o) } })
      .slice(0, MAX_TEXTOS),
    portada: decima(Math.min(600, Math.max(0, num(c.portada, 0.8)))),
  }
}

export function limpiarFormatosPropio(v: unknown, base: FormatosVideoPropio = FORMATOS_PROPIO_INICIAL): FormatosVideoPropio {
  const f = obj(v)
  const b = (k: keyof FormatosVideoPropio) => (typeof f[k] === 'boolean' ? (f[k] as boolean) : base[k])
  return { reel: b('reel'), historiaVideo: b('historiaVideo'), videoFeed: b('videoFeed') }
}

// ---------------------------------------------------------------------------
// Tiempos: los clips se unen con un corte suave (cada unión se come TRANSICION segundos),
// y lo mismo la apertura y el cierre.
// ---------------------------------------------------------------------------
export function duracionMedio(clips: Pick<ClipVideo, 'desde' | 'hasta'>[]): number {
  if (!clips.length) return 0
  const suma = clips.reduce((s, c) => s + Math.max(0, c.hasta - c.desde), 0)
  return Math.round((suma - TRANSICION * (clips.length - 1)) * 100) / 100
}

export type Tiempos = { medio: number; inicioMedio: number; apertura: number; cierre: number; total: number; clips: { inicio: number; duracion: number }[] }

export function tiempos(c: Pick<ContenidoVideo, 'clips' | 'apertura' | 'cierre'>): Tiempos {
  const medio = duracionMedio(c.clips)
  const apertura = c.apertura.activa ? DUR_APERTURA : 0
  const cierre = c.cierre.activa ? DUR_CIERRE : 0
  const uniones = (apertura ? 1 : 0) + (cierre ? 1 : 0)
  let t = 0
  const clips = c.clips.map((x) => {
    const r = { inicio: Math.round(t * 100) / 100, duracion: Math.round((x.hasta - x.desde) * 100) / 100 }
    t += x.hasta - x.desde - TRANSICION
    return r
  })
  return {
    medio,
    inicioMedio: apertura ? Math.round((apertura - TRANSICION) * 100) / 100 : 0,
    apertura,
    cierre,
    total: medio > 0 ? Math.round((apertura + medio + cierre - TRANSICION * uniones) * 100) / 100 : 0,
    clips,
  }
}

/** Cuáles de la lista se pisan en el tiempo (pares de posiciones). */
export function superpuestos(items: { desde: number; hasta: number }[]): [number, number][] {
  const r: [number, number][] = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (items[i].desde < items[j].hasta - 0.05 && items[j].desde < items[i].hasta - 0.05) r.push([i, j])
  return r
}

export const formatosElegidos = (f: FormatosVideoPropio): FormatoVideo[] => (Object.keys(FORMATOS_VIDEO) as FormatoVideo[]).filter((k) => f[k])

export type VideoBiblioteca = { id: number; nombre: string; estado: string; duracion: number | null }

/** Lo que impide armar el video (bloquean) y lo que conviene mirar (avisos). */
export function revisarPieza(c: ContenidoVideo, f: FormatosVideoPropio, videos: Record<number, VideoBiblioteca | undefined>, nombres: Record<number, string> = {}, sinPrecio: number[] = []): { bloquean: string[]; avisos: string[] } {
  const bloquean: string[] = []
  const avisos: string[] = []
  if (!c.clips.length) bloquean.push('Sumá al menos un clip de «Mis videos».')
  c.clips.forEach((x, i) => {
    const v = videos[x.videoId]
    if (!v) bloquean.push(`El clip ${i + 1} ya no está en «Mis videos»: sacalo.`)
    else if (v.estado !== 'listo') bloquean.push(`«${v.nombre}» todavía se está preparando.`)
  })
  if (!formatosElegidos(f).length) bloquean.push('Marcá dónde sale (reel, historia en video o video de feed).')
  const t = tiempos(c)
  for (const fmt of formatosElegidos(f)) {
    if (t.total > MAX_TOTAL[fmt] + 0.05) bloquean.push(`${FORMATOS_VIDEO[fmt].nombre}: dura ${segundos(t.total)} s y acepta hasta ${MAX_TOTAL[fmt]} s. Recortá los clips${c.apertura.activa || c.cierre.activa ? ' o sacá la apertura o el cierre' : ''}.`)
  }
  if (c.apertura.activa && !c.apertura.titulo.trim()) bloquean.push('Escribí el título de la apertura (o sacala).')
  const nombre = (id: number) => nombres[id] ?? `el producto ${id}`
  for (const [i, j] of superpuestos(c.productos)) bloquean.push(`Las franjas de «${nombre(c.productos[i].id)}» y «${nombre(c.productos[j].id)}» se pisan: cambiá los segundos.`)
  for (const [i, j] of superpuestos(c.textos)) bloquean.push(`Los textos ${i + 1} y ${j + 1} se pisan: cambiá los segundos.`)
  c.textos.forEach((x, i) => { if (!x.texto.trim()) bloquean.push(`Escribí el texto ${i + 1} (o sacalo).`) })
  for (const id of sinPrecio) avisos.push(`«${nombre(id)}» no tiene precio en esta lista: la franja sale sin precio.`)
  if (c.sonido.modo !== 'original' && !c.sonido.musicaId) avisos.push('Elegí un tema de música (si no, sale sin música).')
  if (c.portada > t.total && t.total > 0) avisos.push('El segundo de la portada es más largo que el video: se usa el último cuadro.')
  return { bloquean, avisos }
}

/** Cuándo se borra solo un video que no se usa (null si se conserva o está en uso). */
export function fechaBorrado(v: { creadoEn: Date; usadoEn: Date | null; conservar: boolean }, enUso: boolean): Date | null {
  if (v.conservar || enUso) return null
  const base = Math.max(v.creadoEn.getTime(), v.usadoEn?.getTime() ?? 0)
  return new Date(base + DIAS_LIMPIEZA * 864e5)
}

/** Si conviene avisar que se va a borrar (faltan 14 días o menos). */
export const porBorrarse = (fecha: Date | null, ahora = new Date()) => !!fecha && fecha.getTime() - ahora.getTime() <= DIAS_AVISO * 864e5

/** Cómo achicar el video subido: el lado largo hasta 1920 (1080p), sin agrandar. */
export function medidaComprimida(ancho: number, alto: number): { ancho: number; alto: number } {
  const largo = Math.max(ancho, alto)
  const k = largo > 1920 ? 1920 / largo : 1
  const par = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2)
  return { ancho: par(ancho), alto: par(alto) }
}

// ---------------------------------------------------------------------------
// ffmpeg: arma el comando que une todo. Entradas: la apertura, los clips, el cierre, las capas (PNG con
// transparencia, ya en su lugar final) y la música. Las capas se animan con expresiones de ffmpeg
// (entran deslizándose), así no hace falta dibujar cuadro por cuadro en el navegador.
// ---------------------------------------------------------------------------
export type AnimacionCapa = 'fijo' | 'izquierda' | 'arriba' | 'aparecer'
export type CapaFfmpeg = { archivo: string; x: number; y: number; desde: number; hasta: number; animacion: AnimacionCapa }
export type PlanFfmpeg = {
  ancho: number
  alto: number
  encuadre: ContenidoVideo['encuadre']
  clips: { archivo: string; desde: number; duracion: number; conAudio: boolean; ancho: number; alto: number }[]
  apertura: { archivo: string; duracion: number } | null
  cierre: { archivo: string; duracion: number } | null
  capas: CapaFfmpeg[]
  sonido: ContenidoVideo['sonido']['modo']
  musica: string | null
  salida: string
}

const f2 = (n: number) => (Math.round(n * 1000) / 1000).toString()
const ENTRA = 0.45
const SALE = 0.35
// 0 afuera → 1 en su lugar, con entrada y salida suaves
const avance = (a: number, b: number) => `sin(PI/2*min(clip((t-${f2(a)})/${ENTRA},0,1),clip((${f2(b)}-t)/${SALE},0,1)))`

/** Si el video ya tiene (casi) la forma del formato, se cubre directo, sin fondo desenfocado. */
export const mismaForma = (a: { ancho: number; alto: number }, b: { ancho: number; alto: number }) => Math.abs(a.ancho / a.alto - b.ancho / b.alto) / (b.ancho / b.alto) < 0.03

export function argumentosFfmpeg(p: PlanFfmpeg): { args: string[]; total: number; medio: number } {
  const W = p.ancho, H = p.alto, T = TRANSICION
  const entradas: string[] = []
  const filtros: string[] = []
  let n = 0
  const comun = `fps=30,setsar=1,format=yuv420p,settb=AVTB`

  // Apertura
  let ap = -1
  if (p.apertura) { entradas.push('-i', p.apertura.archivo); ap = n++ }
  // Clips: cada uno recortado (desde y duración) al entrar
  const clipsIdx = p.clips.map((c) => { entradas.push('-ss', f2(c.desde), '-t', f2(c.duracion), '-i', c.archivo); return n++ })
  let ci = -1
  if (p.cierre) { entradas.push('-i', p.cierre.archivo); ci = n++ }

  const medio = Math.round((p.clips.reduce((s, c) => s + c.duracion, 0) - T * (p.clips.length - 1)) * 1000) / 1000
  const capasIdx = p.capas.map((c) => { entradas.push('-loop', '1', '-framerate', '30', '-t', f2(medio), '-i', c.archivo); return n++ })
  let mu = -1
  if (p.musica && p.sonido !== 'original') { entradas.push('-stream_loop', '-1', '-i', p.musica); mu = n++ }

  // Cada clip a la medida del formato
  p.clips.forEach((c, i) => {
    const k = clipsIdx[i]
    const largo = `tpad=stop_mode=clone:stop_duration=2,trim=duration=${f2(c.duracion)},setpts=PTS-STARTPTS`
    if (p.encuadre === 'recorte' || mismaForma(c, { ancho: W, alto: H })) {
      filtros.push(`[${k}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${comun},${largo}[v${i}]`)
    } else {
      // Fondo: el mismo video, chico, desenfocado y agrandado (rinde mucho más que desenfocar en grande)
      const fw = Math.round(W / 4), fh = Math.round(H / 4)
      filtros.push(`[${k}:v]split[f${i}][d${i}]`)
      filtros.push(`[f${i}]scale=${fw}:${fh}:force_original_aspect_ratio=increase,crop=${fw}:${fh},boxblur=10:2,scale=${W}:${H},eq=brightness=-0.06:saturation=0.9[fb${i}]`)
      filtros.push(`[d${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[fd${i}]`)
      filtros.push(`[fb${i}][fd${i}]overlay=(W-w)/2:(H-h)/2,${comun},${largo}[v${i}]`)
    }
    const audio = c.conAudio ? `[${k}:a]` : `anullsrc=r=44100:cl=stereo,`
    filtros.push(`${audio}aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=0:${f2(c.duracion)},asetpts=PTS-STARTPTS[a${i}]`)
  })

  // Clips unidos con un corte suave
  let v = 'v0', a = 'a0', fin = p.clips[0]?.duracion ?? 0
  for (let i = 1; i < p.clips.length; i++) {
    filtros.push(`[${v}][v${i}]xfade=transition=fade:duration=${T}:offset=${f2(fin - T)}[x${i}]`)
    filtros.push(`[${a}][a${i}]acrossfade=d=${T}[y${i}]`)
    v = `x${i}`; a = `y${i}`
    fin += p.clips[i].duracion - T
  }

  // Capas: logo y tienda fijas; franjas desde la izquierda; textos desde arriba; sellos que aparecen
  p.capas.forEach((c, j) => {
    const k = capasIdx[j]
    let entrada = `[${k}:v]format=rgba`
    let x = String(c.x), y = String(c.y), habilitar = ''
    if (c.animacion === 'fijo') entrada += `,fade=t=in:st=0:d=0.4:alpha=1`
    if (c.animacion === 'aparecer') {
      entrada += `,fade=t=in:st=${f2(c.desde + 0.35)}:d=0.25:alpha=1,fade=t=out:st=${f2(Math.max(c.desde + 0.6, c.hasta - SALE))}:d=0.25:alpha=1`
      habilitar = `:enable='between(t,${f2(c.desde)},${f2(c.hasta)})'`
    }
    if (c.animacion === 'izquierda') { x = `'${c.x}-(w+${c.x}+40)*(1-${avance(c.desde, c.hasta)})'`; habilitar = `:enable='between(t,${f2(c.desde)},${f2(c.hasta)})'` }
    if (c.animacion === 'arriba') { y = `'${c.y}-(h+${c.y}+40)*(1-${avance(c.desde, c.hasta)})'`; habilitar = `:enable='between(t,${f2(c.desde)},${f2(c.hasta)})'` }
    filtros.push(`${entrada}[c${j}]`)
    filtros.push(`[${v}][c${j}]overlay=x=${x}:y=${y}:eof_action=repeat${habilitar}[o${j}]`)
    v = `o${j}`
  })

  // Apertura → clips → cierre
  let total = medio
  if (ap >= 0) {
    filtros.push(`[${ap}:v]scale=${W}:${H},${comun},tpad=stop_mode=clone:stop_duration=1,trim=duration=${f2(p.apertura!.duracion)},setpts=PTS-STARTPTS[ap]`)
    filtros.push(`[ap][${v}]xfade=transition=fade:duration=${T}:offset=${f2(p.apertura!.duracion - T)}[va]`)
    v = 'va'
    total += p.apertura!.duracion - T
  }
  if (ci >= 0) {
    filtros.push(`[${ci}:v]scale=${W}:${H},${comun},tpad=stop_mode=clone:stop_duration=1,trim=duration=${f2(p.cierre!.duracion)},setpts=PTS-STARTPTS[ci]`)
    filtros.push(`[${v}][ci]xfade=transition=fade:duration=${T}:offset=${f2(total - T)}[vc]`)
    v = 'vc'
    total += p.cierre!.duracion - T
  }
  total = Math.round(total * 1000) / 1000
  filtros.push(`[${v}]format=yuv420p[vout]`)

  // Sonido: el original va solo con los clips (la apertura y el cierre, sin voz); la música, de punta a punta
  const inicio = p.apertura ? p.apertura.duracion - T : 0
  const conOriginal = p.sonido !== 'musica' && p.clips.length > 0
  const conMusica = mu >= 0
  if (conOriginal) filtros.push(`[${a}]adelay=delays=${Math.round(inicio * 1000)}:all=1,apad,atrim=0:${f2(total)},asetpts=PTS-STARTPTS[orig]`)
  else if (p.clips.length) filtros.push(`[${a}]anullsink`)
  if (conMusica) {
    const volumen = p.sonido === 'ambos' ? VOLUMEN_MUSICA_MEZCLA : 1
    filtros.push(`[${mu}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${f2(total)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st=${f2(Math.max(0, total - 1.2))}:d=1.2,volume=${volumen}[mus]`)
  }
  if (conOriginal && conMusica) filtros.push(`[orig][mus]amix=inputs=2:duration=longest:normalize=0,atrim=0:${f2(total)},asetpts=PTS-STARTPTS[aout]`)
  else if (conOriginal) filtros.push(`[orig]anull[aout]`)
  else if (conMusica) filtros.push(`[mus]anull[aout]`)
  else filtros.push(`anullsrc=r=44100:cl=stereo,atrim=0:${f2(total)}[aout]`)

  const args = [
    '-y', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
    ...entradas,
    '-filter_complex', filtros.join(';'),
    '-map', '[vout]', '-map', '[aout]', '-t', f2(total),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '30', '-threads', '2',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-movflags', '+faststart', '-f', 'mp4', p.salida,
  ]
  return { args, total, medio }
}

/** Comando para comprimir el video subido a 1080p H.264 (con tono corregido si viene en HDR del celular). */
export function argumentosComprimir(o: { entrada: string; salida: string; ancho: number; alto: number; hdr: boolean; conAudio: boolean; tonemap: boolean }): string[] {
  const m = medidaComprimida(o.ancho, o.alto)
  const tono = o.hdr && o.tonemap ? 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,' : ''
  return [
    '-y', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
    '-i', o.entrada,
    '-map', '0:v:0', ...(o.conAudio ? ['-map', '0:a:0'] : []),
    '-vf', `${tono}scale=${m.ancho}:${m.alto},fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-profile:v', 'high', '-threads', '2',
    ...(o.conAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100'] : []),
    '-movflags', '+faststart', '-f', 'mp4', o.salida,
  ]
}
