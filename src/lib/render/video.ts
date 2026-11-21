import 'server-only'
import { spawn } from 'node:child_process'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { conNavegador } from './navegador'
import { FPS } from '@/lib/video/tipos'

// Graba un video animado: Chromium abre la página, se pausan todas las animaciones y se mueven a cada instante
// (30 cuadros por segundo); cada cuadro va directo a ffmpeg, que arma el MP4 (H.264 + AAC, como pide Instagram).
// ffmpeg usa 2 hilos: el servidor se comparte con el ERP.


export type OpcionesGrabar = { salida: string; portada: string; segundoPortada: number; musica: string | null; alAvanzar?: (pct: number) => void }

export function grabarVideo(url: string, o: OpcionesGrabar): Promise<{ duracion: number }> {
  return conNavegador(async (b) => {
    const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    const temporal = `${o.salida}.${process.pid}.tmp.mp4`
    try {
      const page = await ctx.newPage()
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      if (!res?.ok()) throw new Error(`El video respondió ${res?.status() ?? 'sin respuesta'}`)
      if (new URL(page.url()).pathname !== new URL(url).pathname) throw new Error('El video se redirigió a otra página (¿firma vencida?)')
      const meta = await page.evaluate(() => ({
        tam: document.querySelector('meta[name="pieza-tamano"]')?.getAttribute('content') ?? '1080x1920',
        dur: Number(document.querySelector('meta[name="video-duracion"]')?.getAttribute('content') ?? 0),
      }))
      const [w, h] = meta.tam.split('x').map(Number)
      if (w && h) await page.setViewportSize({ width: w, height: h })
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
      })
      await page.waitForSelector('html[data-listo]', { state: 'attached', timeout: 10_000 }).catch(() => {})
      if (!(meta.dur > 0)) throw new Error('El video no tiene duración.')
      const cuadros = Math.ceil(meta.dur * FPS)
      const ir = (t: number) => page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms } }, t)

      await mkdir(path.dirname(o.salida), { recursive: true })
      const audio = o.musica ? ['-stream_loop', '-1', '-i', o.musica] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']
      const fundido = o.musica ? ['-af', `afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, meta.dur - 1.2).toFixed(2)}:d=1.2`] : []
      const ff = spawn('ffmpeg', [
        '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
        ...audio,
        '-map', '0:v', '-map', '1:a', '-t', meta.dur.toFixed(2),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), '-threads', '2',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', ...fundido,
        '-movflags', '+faststart', '-f', 'mp4', temporal,
      ], { stdio: ['pipe', 'ignore', 'pipe'] })
      let error = ''
      ff.stderr.on('data', (x) => { error = (error + x).slice(-2000) })
      const termino = new Promise<number>((r) => ff.on('close', (c) => r(c ?? 1)))
      const escribir = (buf: Buffer) => new Promise<void>((r, j) => { if (!ff.stdin.write(buf)) ff.stdin.once('drain', r); else r(); ff.stdin.once('error', j) })

      for (let i = 0; i < cuadros; i++) {
        await ir((i / FPS) * 1000)
        await escribir(await page.screenshot({ type: 'jpeg', quality: 90 }))
        if (i % 15 === 0) o.alAvanzar?.(i / cuadros)
      }
      ff.stdin.end()
      // La portada del reel: el cuadro del segundo elegido
      await ir(Math.min(o.segundoPortada, meta.dur - 0.05) * 1000)
      await writeFile(o.portada, await page.screenshot({ type: 'jpeg', quality: 90 }))
      const codigo = await termino
      if (codigo !== 0) throw new Error(`ffmpeg no pudo armar el video: ${error.trim().split('\n').pop() ?? codigo}`)
      await rename(temporal, o.salida)
      return { duracion: meta.dur }
    } finally {
      await rm(temporal, { force: true }).catch(() => {})
      await ctx.close()
    }
  })
}

/** Duración de un audio (para la biblioteca de música). null si no es un audio que ffmpeg pueda leer. */
export function duracionAudio(archivo: string): Promise<number | null> {
  return new Promise((r) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { stdio: ['ignore', 'pipe', 'ignore'] })
    let s = ''
    p.stdout.on('data', (x) => { s += x })
    p.on('error', () => r(null))
    p.on('close', (c) => { const n = Number(s.trim()); r(c === 0 && n > 0 ? n : null) })
  })
}

/** Versión de ffmpeg (para el diagnóstico del motor). */
export function versionFfmpeg(): Promise<string | null> {
  return new Promise((r) => {
    const p = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'ignore'] })
    let s = ''
    p.stdout.on('data', (x) => { s += x })
    p.on('error', () => r(null))
    p.on('close', (c) => r(c === 0 ? s.split('\n')[0].replace(/ Copyright.*/, '') : null))
  })
}
