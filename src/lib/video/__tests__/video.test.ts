import { describe, expect, it } from 'vitest'
import { limpiarAnimacion, limpiarFormatosCarrusel, planTiempos, videosDe } from '../tipos'
import { htmlVideo, type EscenaVideo } from '../escenas'
import { envolverHistoria } from '@/lib/carruseles/historia'
import { planDestinosVideo } from '@/lib/publicaciones/reglas'

const contacto = { web: 'tiendaonline.saboryaroma.com', whatsapp: '370 462-1563', instagram: '@saboryaroma__' }
const producto = (n: number): EscenaVideo => ({ tipo: 'producto', etiqueta: 'NutriOferta', nombre: [`Producto`, `número ${n}`], linea: 'Marca · 500 g', precio: { texto: '$ 2.370', unidad: '', antes: '$ 2.800' }, frase: 'Rico y sano', foto: '/media/x.webp', sello: 'Oferta' })
const escenas = (n: number): EscenaVideo[] => [{ tipo: 'portada', titulo: ['Nutri', 'Ofertas'], sello: 'Precios / bajos' }, ...Array.from({ length: n }, (_, i) => producto(i + 1)), { tipo: 'cierre', titulo: ['Aprovechá'], bajada: null }]
const base = { tema: 'nutriofertas' as const, ancho: 1080, alto: 1920, maximo: 15, ritmo: 'suave' as const, variante: 'auto' as const, semilla: 7, contacto, qr: 'data:image/svg+xml;base64,AA==', vista: false }

describe('tiempos del video', () => {
  it('con pocos productos dura lo natural (no se estira)', () => {
    const t = planTiempos([{ tipo: 'portada' }, { tipo: 'producto' }, { tipo: 'cierre' }], 30, 'suave')
    expect(t.total).toBeCloseTo(2.4 + 3.3 + 2.8, 1)
    expect(t.omitidas).toBe(0)
  })
  it('si no entra, acorta los productos y nunca pasa el máximo', () => {
    const t = planTiempos([{ tipo: 'portada' }, ...Array.from({ length: 4 }, () => ({ tipo: 'producto' as const })), { tipo: 'cierre' }], 15, 'suave')
    expect(t.total).toBeLessThanOrEqual(15.01)
    expect(t.omitidas).toBe(0)
  })
  it('si ni acortando entra, deja afuera los últimos productos (y avisa cuántos)', () => {
    const t = planTiempos([{ tipo: 'portada' }, ...Array.from({ length: 6 }, () => ({ tipo: 'producto' as const })), { tipo: 'cierre' }], 8, 'suave')
    expect(t.total).toBeLessThanOrEqual(8.01)
    expect(t.omitidas).toBeGreaterThan(0)
    expect(t.indices[0]).toBe(0)
    expect(t.indices.at(-1)).toBe(7)
  })
  it('el ritmo dinámico es más corto', () => {
    const lento = planTiempos(escenas(2).map((e) => ({ tipo: e.tipo })), 30, 'suave').total
    const rapido = planTiempos(escenas(2).map((e) => ({ tipo: e.tipo })), 30, 'dinamico').total
    expect(rapido).toBeLessThan(lento)
  })
})

describe('ajustes del video', () => {
  it('limpia la animación con sus valores posibles', () => {
    expect(limpiarAnimacion({ duracion: 20, ritmo: 'dinamico', variante: '2', musicaId: 3, portada: '1,5' })).toEqual({ duracion: 20, ritmo: 'dinamico', variante: '2', musicaId: 3, portada: 1.5 })
    expect(limpiarAnimacion({ duracion: 12, ritmo: 'raro', variante: 9, musicaId: -1 })).toEqual({ duracion: 15, ritmo: 'suave', variante: 'auto', musicaId: null, portada: 0.8 })
  })
  it('formatos de entrada de un carrusel viejo: solo el carrusel', () => {
    expect(limpiarFormatosCarrusel(null)).toEqual({ carrusel: true, historia: false, reel: false, historiaVideo: false, videoFeed: false })
    expect(videosDe({ reel: true, historiaVideo: false, videoFeed: true })).toEqual(['reel', 'videoFeed'])
  })
})

describe('HTML del video', () => {
  it('declara tamaño y duración, y lleva una escena por parte', () => {
    const r = htmlVideo({ ...base, escenas: escenas(2) })
    expect(r.html).toContain('content="1080x1920"')
    expect(r.html).toContain(`name="video-duracion" content="${r.total}"`)
    expect((r.html.match(/<section class="escena"/g) ?? []).length).toBe(4)
    expect(r.html).toContain('Precios<br>bajos')
    expect(r.html).toContain('data-ajustar')
  })
  it('escapa los textos', () => {
    const r = htmlVideo({ ...base, escenas: [{ tipo: 'portada', titulo: ['<b>hola</b>'] }, { tipo: 'cierre', titulo: ['x'], bajada: null }] })
    expect(r.html).not.toContain('<b>hola</b>')
    expect(r.html).toContain('&lt;b&gt;hola&lt;/b&gt;')
  })
  it('la vista previa trae su reloj; la de grabar no', () => {
    expect(htmlVideo({ ...base, escenas: escenas(1), vista: true }).html).toContain('requestAnimationFrame')
    expect(htmlVideo({ ...base, escenas: escenas(1) }).html).not.toContain('requestAnimationFrame')
  })
  it('el video de feed es 4:5 y los 4 estilos arman sin errores', () => {
    expect(htmlVideo({ ...base, alto: 1350, escenas: escenas(1) }).html).toContain('content="1080x1350"')
    for (const tema of ['nutriofertas', 'recetas', 'lanzamiento', 'promo'] as const) {
      expect(htmlVideo({ ...base, tema, escenas: [...escenas(1), { tipo: 'lista', titulo: ['Lista'], items: [{ foto: null, texto: 'uno' }] }, { tipo: 'pasos', titulo: ['Pasos'], pasos: ['a', 'b'], foto: null }] }).total).toBeGreaterThan(0)
    }
  })
  it('la misma pieza y semilla arma siempre lo mismo (la huella sirve)', () => {
    expect(htmlVideo({ ...base, escenas: escenas(2) }).html).toBe(htmlVideo({ ...base, escenas: escenas(2) }).html)
  })
})

describe('historia desde una placa', () => {
  it('pasa la placa a 1080×1920 con franjas arriba y abajo', () => {
    const placa = '<!doctype html><html><head><meta name="pieza-tamano" content="1080x1350"></head><body><div class="placa"></div></body></html>'
    const h = envolverHistoria(placa, 'nutriofertas', contacto)
    expect(h).toContain('content="1080x1920"')
    expect(h).toContain('NutriOfertas de la semana')
    expect(h).toContain('Pedí por WhatsApp 370 462-1563')
    expect(h.indexOf('h-arriba')).toBeLessThan(h.indexOf('class="placa"'))
  })
})

describe('destinos de los videos', () => {
  it('reel a reels, historia a historias, video de feed al feed', () => {
    const ambas = { instagram: true, facebook: true }
    expect(planDestinosVideo('reel', ambas).map((d) => `${d.red}-${d.ubicacion}`)).toEqual(['instagram-reel', 'facebook-reel'])
    expect(planDestinosVideo('historiaVideo', ambas).map((d) => `${d.red}-${d.ubicacion}`)).toEqual(['instagram-historia', 'facebook-historia'])
    expect(planDestinosVideo('videoFeed', ambas).map((d) => `${d.red}-${d.ubicacion}`)).toEqual(['instagram-reel', 'facebook-feed'])
    expect(planDestinosVideo('reel', { instagram: false, facebook: true })).toHaveLength(1)
  })
})
