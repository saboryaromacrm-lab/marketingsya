import 'server-only'
import type { Browser } from 'playwright-core'

// Un solo Chromium para toda la plataforma: se abre al primer render y se cierra
// solo después de 3 minutos sin uso, para no ocupar memoria (el servidor se comparte con el ERP).
// Los renders van de a uno: así la memoria queda acotada aunque se pidan varios a la vez.

const INACTIVIDAD_MS = 3 * 60_000
const global = globalThis as unknown as { navegador?: Promise<Browser>; cierre?: NodeJS.Timeout; turno?: Promise<unknown> }

async function abrir(): Promise<Browser> {
  const { chromium } = await import('playwright-core')
  const b = await chromium.launch({
    // En Docker corre como usuario sin privilegios: el sandbox de Chromium necesita permisos que el contenedor no da.
    chromiumSandbox: false,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--disable-dev-shm-usage', '--font-render-hinting=none'],
  })
  b.on('disconnected', () => { global.navegador = undefined })
  return b
}

function programarCierre() {
  clearTimeout(global.cierre)
  global.cierre = setTimeout(async () => {
    const b = await global.navegador?.catch(() => undefined)
    global.navegador = undefined
    await b?.close().catch(() => {})
  }, INACTIVIDAD_MS)
  global.cierre.unref()
}

/** Ejecuta algo con el navegador, de a uno por vez. */
export async function conNavegador<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const anterior = global.turno ?? Promise.resolve()
  const actual = anterior.catch(() => {}).then(async () => {
    global.navegador ??= abrir().catch((e) => { global.navegador = undefined; throw e })
    try {
      return await fn(await global.navegador)
    } finally {
      programarCierre()
    }
  })
  global.turno = actual
  return actual
}

export type OpcionesRender = { ancho?: number; alto?: number; calidad?: number; alAvanzar?: (hechas: number) => void }

/** Abre cada dirección y la guarda como JPEG: 1080×1350 o el tamaño que declare la placa. */
export function renderizarJpeg(urls: string[], o: OpcionesRender = {}): Promise<Buffer[]> {
  const ancho = o.ancho ?? 1080
  const alto = o.alto ?? 1350
  return conNavegador(async (b) => {
    const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 })
    try {
      const page = await ctx.newPage()
      const salida: Buffer[] = []
      for (const url of urls) {
        const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
        if (!res?.ok()) throw new Error(`La placa respondió ${res?.status() ?? 'sin respuesta'}`)
        // Si la placa terminó en otra página (por ejemplo, el ingreso porque la firma no valió),
        // se corta: mejor un error claro que un JPEG de la pantalla equivocada.
        if (new URL(page.url()).pathname !== new URL(url).pathname) {
          throw new Error(`La placa ${new URL(url).pathname} se redirigió a ${new URL(page.url()).pathname}`)
        }
        // Que estén las fuentes y todas las fotos antes de sacar la «foto» de la placa
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
        })
        // Una placa puede declarar su tamaño (por ejemplo, las historias de 1080×1920)
        const declarado = await page.evaluate(() => document.querySelector('meta[name="pieza-tamano"]')?.getAttribute('content') ?? null)
        const m = declarado?.match(/^(\d{3,4})x(\d{3,4})$/)
        const [w, h] = m ? [Number(m[1]), Number(m[2])] : [ancho, alto]
        if (w !== page.viewportSize()?.width || h !== page.viewportSize()?.height) await page.setViewportSize({ width: w, height: h })
        salida.push(await page.screenshot({ type: 'jpeg', quality: o.calidad ?? 90, clip: { x: 0, y: 0, width: w, height: h } }))
        o.alAvanzar?.(salida.length)
      }
      return salida
    } finally {
      await ctx.close()
    }
  })
}
