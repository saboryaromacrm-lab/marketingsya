import 'server-only'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { conNavegador } from './navegador'

// Herramientas del motor para los videos propios: leer un video (ffprobe), correr ffmpeg con avance,
// y sacar las capas de encima como PNG con fondo transparente.

export type InfoVideo = { duracion: number; ancho: number; alto: number; conAudio: boolean; hdr: boolean; codec: string }

/** Lee un video: duración, medida como se ve (girada si el celular la grabó de costado), audio y si viene en HDR. null si no es un video. */
export function sondearVideo(archivo: string): Promise<InfoVideo | null> {
  return new Promise((r) => {
    const p = spawn('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', archivo], { stdio: ['ignore', 'pipe', 'ignore'] })
    let s = ''
    p.stdout.on('data', (x) => { s += x })
    p.on('error', () => r(null))
    p.on('close', (c) => {
      if (c !== 0) return r(null)
      try {
        const j = JSON.parse(s) as { format?: { duration?: string }; streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string; color_transfer?: string; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[] }
        const v = j.streams?.find((x) => x.codec_type === 'video' && x.width && x.height)
        if (!v) return r(null)
        const giro = Math.abs(Number(v.side_data_list?.find((x) => x.rotation != null)?.rotation ?? v.tags?.rotate ?? 0)) % 180
        const duracion = Number(j.format?.duration ?? v.duration ?? 0)
        r({
          duracion: Number.isFinite(duracion) ? duracion : 0,
          ancho: giro === 90 ? v.height! : v.width!,
          alto: giro === 90 ? v.width! : v.height!,
          conAudio: !!j.streams?.some((x) => x.codec_type === 'audio'),
          hdr: v.color_transfer === 'arib-std-b67' || v.color_transfer === 'smpte2084',
          codec: v.codec_name ?? '',
        })
      } catch {
        r(null)
      }
    })
  })
}

let tonemap: Promise<boolean> | null = null
/** Si este ffmpeg puede corregir el tono de los videos HDR del celular (filtro zscale). */
export function puedeCorregirTono(): Promise<boolean> {
  return (tonemap ??= new Promise((r) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-filters'], { stdio: ['ignore', 'pipe', 'ignore'] })
    let s = ''
    p.stdout.on('data', (x) => { s += x })
    p.on('error', () => r(false))
    p.on('close', () => r(/\szscale\s/.test(s) && /\stonemap\s/.test(s)))
  }))
}

/** Corre ffmpeg con «-progress pipe:1» y avisa el avance (0 a 1) según los segundos ya hechos. */
export function correrFfmpeg(args: string[], duracion: number, alAvanzar?: (pct: number) => void): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let error = ''
    let resto = ''
    ff.stdout.on('data', (x: Buffer) => {
      resto += x.toString()
      const lineas = resto.split('\n')
      resto = lineas.pop() ?? ''
      for (const l of lineas) {
        const m = /^out_time_us=(\d+)/.exec(l) ?? /^out_time_ms=(\d+)/.exec(l)
        if (m && duracion > 0) alAvanzar?.(Math.min(1, Number(m[1]) / 1e6 / duracion))
      }
    })
    ff.stderr.on('data', (x) => { error = (error + x).slice(-3000) })
    ff.on('error', (e) => rechazar(new Error(`No se pudo correr ffmpeg: ${e.message}`)))
    ff.on('close', (c) => (c === 0 ? resolver() : rechazar(new Error(`ffmpeg no pudo armar el video: ${error.trim().split('\n').pop() ?? c}`))))
  })
}

/** Un cuadro del video como JPEG (portada del reel o miniatura de la biblioteca). */
export function cuadroJpeg(video: string, segundo: number, salida: string, ancho?: number): Promise<void> {
  return correrFfmpeg(['-y', '-loglevel', 'error', '-ss', String(Math.max(0, segundo)), '-i', video, '-frames:v', '1', ...(ancho ? ['-vf', `scale=${ancho}:-2`] : []), '-q:v', '3', salida], 0)
}

export type CapaCapturada = { id: string; archivo: string; x: number; y: number }

/**
 * Abre la página de capas y saca una foto de cada una (con fondo transparente y un margen para la sombra).
 * Devuelve el archivo y la posición donde va en el video.
 */
export function capturarCapas(url: string, carpeta: string): Promise<CapaCapturada[]> {
  return conNavegador(async (b) => {
    const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    try {
      const page = await ctx.newPage()
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      if (!res?.ok()) throw new Error(`Las capas respondieron ${res?.status() ?? 'sin respuesta'}`)
      if (new URL(page.url()).pathname !== new URL(url).pathname) throw new Error('Las capas se redirigieron a otra página (¿firma vencida?)')
      const tam = await page.evaluate(() => document.querySelector('meta[name="pieza-tamano"]')?.getAttribute('content') ?? '1080x1920')
      const [W, H] = tam.split('x').map(Number)
      await page.setViewportSize({ width: W, height: H })
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
      })
      await page.waitForSelector('html[data-listo]', { state: 'attached', timeout: 10_000 }).catch(() => {})
      const ids = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-capa]')].map((e) => e.dataset.capa!))
      const r: CapaCapturada[] = []
      const M = 44
      for (const id of ids) {
        const caja = await page.evaluate((id) => {
          for (const e of document.querySelectorAll<HTMLElement>('[data-capa]')) e.style.visibility = e.dataset.capa === id ? 'visible' : 'hidden'
          const b = document.querySelector<HTMLElement>(`[data-capa="${id}"]`)!.getBoundingClientRect()
          return { x: b.x, y: b.y, w: b.width, h: b.height }
        }, id)
        const x = Math.max(0, Math.floor(caja.x - M)), y = Math.max(0, Math.floor(caja.y - M))
        const w = Math.min(W - x, Math.ceil(caja.w + 2 * M)), h = Math.min(H - y, Math.ceil(caja.h + 2 * M + 16))
        if (w <= 0 || h <= 0) continue
        const archivo = path.join(carpeta, `capa-${id}.png`)
        await page.screenshot({ path: archivo, omitBackground: true, clip: { x, y, width: w, height: h } })
        r.push({ id, archivo, x, y })
      }
      return r
    } finally {
      await ctx.close()
    }
  })
}
