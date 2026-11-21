import { describe, expect, it } from 'vitest'
import type { PlanFfmpeg } from '../reglas'
import {
  argumentosComprimir, argumentosFfmpeg, contenidoInicial, duracionMedio, esExtensionVideo, fechaBorrado, limpiarContenido, limpiarFormatosPropio,
  medidaComprimida, mismaForma, mmss, porBorrarse, revisarPieza, superpuestos, tiempos, DUR_APERTURA, DUR_CIERRE, MAX_CLIPS, MAX_PRODUCTOS, TRANSICION,
} from '../reglas'

const base = () => contenidoInicial({ clips: [{ videoId: 1, desde: 0, hasta: 10 }] })

describe('videos propios: tiempos', () => {
  it('los clips se unen con un corte suave que se come 0,3 s por unión', () => {
    expect(duracionMedio([])).toBe(0)
    expect(duracionMedio([{ desde: 0, hasta: 10 }])).toBe(10)
    expect(duracionMedio([{ desde: 2, hasta: 7 }, { desde: 0, hasta: 4 }])).toBe(8.7)
  })
  it('suma la apertura y el cierre, cada uno con su unión', () => {
    const c = base()
    const t = tiempos(c)
    expect(t.medio).toBe(10)
    expect(t.inicioMedio).toBe(DUR_APERTURA - TRANSICION)
    expect(t.total).toBe(Math.round((DUR_APERTURA + 10 + DUR_CIERRE - 2 * TRANSICION) * 100) / 100)
    const sin = tiempos({ ...c, apertura: { ...c.apertura, activa: false }, cierre: { ...c.cierre, activa: false } })
    expect(sin.total).toBe(10)
    expect(sin.inicioMedio).toBe(0)
  })
  it('dónde empieza cada clip en la línea de tiempo', () => {
    const t = tiempos({ ...base(), clips: [{ videoId: 1, desde: 0, hasta: 5 }, { videoId: 2, desde: 1, hasta: 4 }, { videoId: 1, desde: 0, hasta: 2 }] })
    expect(t.clips.map((x) => x.inicio)).toEqual([0, 4.7, 7.4])
    expect(t.medio).toBe(9.4)
  })
  it('sin clips dura 0', () => {
    expect(tiempos({ ...base(), clips: [] }).total).toBe(0)
  })
})

describe('videos propios: limpiar', () => {
  it('saca clips de videos que no están y ajusta los segundos al largo del video', () => {
    const c = limpiarContenido({ clips: [{ videoId: 1, desde: -3, hasta: 99 }, { videoId: 9, desde: 0, hasta: 3 }, { videoId: 2, desde: '1,5', hasta: 1.6 }] }, { 1: 12, 2: 8 })
    expect(c.clips).toEqual([{ videoId: 1, desde: 0, hasta: 12 }, { videoId: 2, desde: 1.5, hasta: 2 }])
  })
  it('hasta 5 clips, 3 productos (sin repetir) y 3 textos', () => {
    const c = limpiarContenido({
      clips: Array.from({ length: 8 }, () => ({ videoId: 1, desde: 0, hasta: 5 })),
      productos: [{ id: 5 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }],
      textos: Array.from({ length: 6 }, (_, i) => ({ texto: `T${i}`, desde: 0, hasta: 1 })),
    }, { 1: 10 })
    expect(c.clips).toHaveLength(MAX_CLIPS)
    expect(c.productos.map((p) => p.id)).toEqual([5, 6, 7])
    expect(c.productos).toHaveLength(MAX_PRODUCTOS)
    expect(c.textos).toHaveLength(3)
  })
  it('las franjas y los textos quedan dentro de los clips y duran al menos 1 s', () => {
    const c = limpiarContenido({ clips: [{ videoId: 1, desde: 0, hasta: 6 }], productos: [{ id: 3, desde: 5.8, hasta: 99, descuento: 150, sello: true }], textos: [{ texto: '  ¡Llegó!   ya ', desde: 2, hasta: 2.2 }] }, { 1: 6 })
    expect(c.productos[0]).toMatchObject({ desde: 5, hasta: 6, descuento: 90, sello: true })
    expect(c.textos[0]).toEqual({ texto: '¡Llegó! ya', desde: 2, hasta: 3 })
  })
  it('valores raros vuelven a los de entrada', () => {
    const c = limpiarContenido({ encuadre: 'x', sonido: { modo: 'raro', musicaId: -1 }, estilo: 'fucsia', listaId: 'a', portada: 'no' }, {})
    expect(c.encuadre).toBe('desenfoque')
    expect(c.sonido).toEqual({ modo: 'original', musicaId: null })
    expect(c.estilo).toBe('nutriofertas')
    expect(c.listaId).toBe(3)
    expect(c.portada).toBe(0.8)
    expect(c.apertura.activa).toBe(true)
    expect(c.cierre.titulo).toBe('Te esperamos')
  })
  it('formatos: de entrada solo el reel', () => {
    expect(limpiarFormatosPropio(null)).toEqual({ reel: true, historiaVideo: false, videoFeed: false })
    expect(limpiarFormatosPropio({ reel: false, videoFeed: true })).toEqual({ reel: false, historiaVideo: false, videoFeed: true })
  })
  it('al armar una pieza nueva, las franjas de los productos se reparten a lo largo del video', () => {
    const c = contenidoInicial({ clips: [{ videoId: 1, desde: 0, hasta: 12 }], productos: [1, 2, 3, 4] })
    expect(c.productos.map((p) => p.id)).toEqual([1, 2, 3])
    expect(superpuestos(c.productos)).toEqual([])
    expect(c.productos.every((p) => p.hasta <= 12 && p.hasta - p.desde >= 1)).toBe(true)
  })
})

describe('videos propios: revisión', () => {
  const listo = { 1: { id: 1, nombre: 'Mostrador', estado: 'listo', duracion: 12 } }
  it('sin problemas', () => {
    expect(revisarPieza(base(), { reel: true, historiaVideo: false, videoFeed: false }, listo).bloquean).toEqual([])
  })
  it('sin clips, video preparándose o que ya no está', () => {
    expect(revisarPieza({ ...base(), clips: [] }, { reel: true, historiaVideo: false, videoFeed: false }, listo).bloquean[0]).toMatch(/Sumá al menos un clip/)
    expect(revisarPieza(base(), { reel: true, historiaVideo: false, videoFeed: false }, { 1: { ...listo[1], estado: 'procesando' } }).bloquean[0]).toMatch(/se está preparando/)
    expect(revisarPieza(base(), { reel: true, historiaVideo: false, videoFeed: false }, {}).bloquean[0]).toMatch(/ya no está/)
  })
  it('la historia en video acepta hasta 60 s y el reel hasta 90 s', () => {
    const largo = { ...base(), clips: [{ videoId: 1, desde: 0, hasta: 30 }, { videoId: 1, desde: 30, hasta: 60 }] }
    const r = revisarPieza(largo, { reel: true, historiaVideo: true, videoFeed: false }, { 1: { ...listo[1], duracion: 120 } })
    expect(r.bloquean).toHaveLength(1)
    expect(r.bloquean[0]).toMatch(/Historia en video: dura .* hasta 60 s/)
  })
  it('franjas o textos que se pisan', () => {
    const c = { ...base(), productos: [{ id: 1, desde: 0, hasta: 4, descuento: 0, sello: false, presentacion: null }, { id: 2, desde: 3, hasta: 6, descuento: 0, sello: false, presentacion: null }], textos: [{ texto: 'A', desde: 0, hasta: 2 }, { texto: '', desde: 2, hasta: 4 }] }
    const r = revisarPieza(c, { reel: true, historiaVideo: false, videoFeed: false }, listo, { 1: 'Maní', 2: 'Granola' })
    expect(r.bloquean.some((x) => /«Maní» y «Granola» se pisan/.test(x))).toBe(true)
    expect(r.bloquean.some((x) => /Escribí el texto 2/.test(x))).toBe(true)
    // Uno termina justo cuando empieza el otro: no se pisan
    expect(superpuestos([{ desde: 0, hasta: 2 }, { desde: 2, hasta: 4 }])).toEqual([])
  })
  it('sin formato, sin título de apertura, música sin tema', () => {
    const c = { ...base(), apertura: { activa: true, kicker: '', titulo: ' ' }, sonido: { modo: 'musica' as const, musicaId: null } }
    const r = revisarPieza(c, { reel: false, historiaVideo: false, videoFeed: false }, listo)
    expect(r.bloquean.some((x) => /Marcá dónde sale/.test(x))).toBe(true)
    expect(r.bloquean.some((x) => /título de la apertura/.test(x))).toBe(true)
    expect(r.avisos.some((x) => /Elegí un tema/.test(x))).toBe(true)
  })
})

describe('videos propios: biblioteca', () => {
  it('extensiones aceptadas', () => {
    expect(esExtensionVideo('IMG_4521.MOV')).toBe(true)
    expect(esExtensionVideo('clip.webm')).toBe(true)
    expect(esExtensionVideo('foto.heic')).toBe(false)
  })
  it('se borra a los 90 días sin usar, contando desde que se subió o se usó por última vez', () => {
    const creadoEn = new Date('2026-01-01T12:00:00Z')
    expect(fechaBorrado({ creadoEn, usadoEn: null, conservar: false }, false)?.toISOString()).toBe('2026-04-01T12:00:00.000Z')
    expect(fechaBorrado({ creadoEn, usadoEn: new Date('2026-02-01T12:00:00Z'), conservar: false }, false)?.toISOString()).toBe('2026-05-02T12:00:00.000Z')
    expect(fechaBorrado({ creadoEn, usadoEn: null, conservar: true }, false)).toBeNull()
    expect(fechaBorrado({ creadoEn, usadoEn: null, conservar: false }, true)).toBeNull()
  })
  it('avisa 14 días antes', () => {
    const ahora = new Date('2026-03-20T12:00:00Z')
    expect(porBorrarse(new Date('2026-04-01T12:00:00Z'), ahora)).toBe(true)
    expect(porBorrarse(new Date('2026-05-01T12:00:00Z'), ahora)).toBe(false)
    expect(porBorrarse(null, ahora)).toBe(false)
  })
  it('la copia comprimida: el lado largo hasta 1920, sin agrandar y en números pares', () => {
    expect(medidaComprimida(3840, 2160)).toEqual({ ancho: 1920, alto: 1080 })
    expect(medidaComprimida(2160, 3840)).toEqual({ ancho: 1080, alto: 1920 })
    expect(medidaComprimida(1280, 720)).toEqual({ ancho: 1280, alto: 720 })
    expect(medidaComprimida(1081, 1921)).toEqual({ ancho: 1080, alto: 1920 })
  })
  it('comprimir: corrige el tono del HDR solo si se puede', () => {
    const conTono = argumentosComprimir({ entrada: 'a.mov', salida: 'b.mp4', ancho: 2160, alto: 3840, hdr: true, conAudio: true, tonemap: true })
    expect(conTono.join(' ')).toMatch(/tonemap=tonemap=hable.*scale=1080:1920,fps=30/)
    expect(conTono).toContain('0:a:0')
    const sinTono = argumentosComprimir({ entrada: 'a.mov', salida: 'b.mp4', ancho: 1920, alto: 1080, hdr: true, conAudio: false, tonemap: false })
    expect(sinTono.join(' ')).not.toMatch(/tonemap/)
    expect(sinTono).not.toContain('0:a:0')
  })
  it('mmss', () => {
    expect(mmss(7.4)).toBe('0:07')
    expect(mmss(65)).toBe('1:05')
  })
})

describe('videos propios: comando de ffmpeg', () => {
  const plan: PlanFfmpeg = {
    ancho: 1080, alto: 1920, encuadre: 'desenfoque',
    clips: [{ archivo: '/m/a.mp4', desde: 1, duracion: 5, conAudio: true, ancho: 1920, alto: 1080 }, { archivo: '/m/b.mp4', desde: 0, duracion: 4, conAudio: false, ancho: 1080, alto: 1920 }],
    apertura: { archivo: '/t/ap.mp4', duracion: 2.4 }, cierre: { archivo: '/t/ci.mp4', duracion: 2.8 },
    capas: [
      { archivo: '/t/url.png', x: 0, y: 20, desde: 0, hasta: 8.7, animacion: 'fijo' as const },
      { archivo: '/t/p0.png', x: 30, y: 1260, desde: 1, hasta: 4, animacion: 'izquierda' as const },
      { archivo: '/t/s0.png', x: 830, y: 1085, desde: 1, hasta: 4, animacion: 'aparecer' as const },
      { archivo: '/t/t0.png', x: 283, y: 300, desde: 4.5, hasta: 7, animacion: 'arriba' as const },
    ],
    sonido: 'ambos', musica: '/m/tema.mp3', salida: '/t/final.mp4',
  }
  it('duración total: clips + apertura + cierre menos las uniones', () => {
    const r = argumentosFfmpeg(plan)
    expect(r.medio).toBe(8.7)
    expect(r.total).toBe(13.3)
    expect(r.args).toContain('13.3')
  })
  it('entradas en orden: apertura, clips recortados, cierre, capas en bucle y música', () => {
    const a = argumentosFfmpeg(plan).args
    const entradas = a.map((x, i) => (x === '-i' ? a[i + 1] : null)).filter(Boolean)
    expect(entradas).toEqual(['/t/ap.mp4', '/m/a.mp4', '/m/b.mp4', '/t/ci.mp4', '/t/url.png', '/t/p0.png', '/t/s0.png', '/t/t0.png', '/m/tema.mp3'])
    expect(a.join(' ')).toMatch(/-ss 1 -t 5 -i \/m\/a\.mp4/)
    expect(a.join(' ')).toMatch(/-stream_loop -1 -i \/m\/tema\.mp3/)
  })
  it('el horizontal lleva fondo desenfocado; el vertical en un reel se cubre directo', () => {
    const fc = argumentosFfmpeg(plan).args[argumentosFfmpeg(plan).args.indexOf('-filter_complex') + 1]
    expect(fc).toMatch(/\[1:v\]split\[f0\]\[d0\]/)
    expect(fc).toMatch(/boxblur/)
    expect(fc).toMatch(/\[2:v\]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920/)
    // Clip sin audio: silencio del mismo largo
    expect(fc).toMatch(/anullsrc=r=44100:cl=stereo,aresample.*atrim=0:4.*\[a1\]/)
    expect(fc).toMatch(/xfade=transition=fade:duration=0.3:offset=4.7\[x1\]/)
    expect(fc).toMatch(/acrossfade=d=0.3/)
  })
  it('las capas se animan: franja desde la izquierda, texto desde arriba, sello que aparece', () => {
    const fc = argumentosFfmpeg(plan).args[argumentosFfmpeg(plan).args.indexOf('-filter_complex') + 1]
    expect(fc).toMatch(/overlay=x='30-\(w\+30\+40\)\*\(1-sin\(PI\/2\*min\(clip\(\(t-1\)\/0.45,0,1\),clip\(\(4-t\)\/0.35,0,1\)\)\)\)':y=1260/)
    expect(fc).toMatch(/enable='between\(t,4.5,7\)'/)
    expect(fc).toMatch(/fade=t=in:st=1.35:d=0.25:alpha=1/)
    expect(fc).toMatch(/fade=t=in:st=0:d=0.4:alpha=1/)
  })
  it('sonido: el original va después de la apertura; con los dos, la música bajita', () => {
    const fc = (p: PlanFfmpeg) => { const a = argumentosFfmpeg(p).args; return a[a.indexOf('-filter_complex') + 1] }
    expect(fc(plan)).toMatch(/adelay=delays=2100:all=1/)
    expect(fc(plan)).toMatch(/volume=0.25\[mus\]/)
    expect(fc(plan)).toMatch(/\[orig\]\[mus\]amix/)
    expect(fc({ ...plan, sonido: 'musica' })).toMatch(/volume=1\[mus\]/)
    expect(fc({ ...plan, sonido: 'musica' })).toMatch(/anullsink/)
    expect(fc({ ...plan, sonido: 'musica' })).not.toMatch(/\[orig\]/)
    expect(fc({ ...plan, sonido: 'original' })).not.toMatch(/\[mus\]/)
    expect(argumentosFfmpeg({ ...plan, sonido: 'original' }).args).not.toContain('/m/tema.mp3')
    expect(fc({ ...plan, sonido: 'musica', musica: null })).toMatch(/anullsrc=r=44100:cl=stereo,atrim=0:13.3\[aout\]/)
  })
  it('sin apertura ni cierre, el video son solo los clips', () => {
    const r = argumentosFfmpeg({ ...plan, apertura: null, cierre: null })
    expect(r.total).toBe(8.7)
    expect(r.args.join(' ')).not.toMatch(/\[ap\]|\[ci\]/)
  })
  it('recortar al centro: sin fondo desenfocado', () => {
    const a = argumentosFfmpeg({ ...plan, encuadre: 'recorte' }).args
    expect(a[a.indexOf('-filter_complex') + 1]).not.toMatch(/boxblur/)
  })
  it('misma forma con 3 % de margen', () => {
    expect(mismaForma({ ancho: 1080, alto: 1920 }, { ancho: 1080, alto: 1920 })).toBe(true)
    expect(mismaForma({ ancho: 720, alto: 1280 }, { ancho: 1080, alto: 1920 })).toBe(true)
    expect(mismaForma({ ancho: 1080, alto: 1350 }, { ancho: 1080, alto: 1920 })).toBe(false)
  })
})
