import { describe, expect, it } from 'vitest'
import { aInstante, contarTexto, estadoGeneral, llevaTexto, partesFormosa, planDestinos, problemasDelTexto, problemasDePlan, textoAlternativo, textoCuando } from '../reglas'

const todos = { feed: { instagram: true, facebook: true }, historia: { instagram: true, facebook: true } }

describe('fechas de Formosa', () => {
  it('convierte día y hora de Formosa a UTC (UTC−3) y vuelve', () => {
    const d = aInstante('2026-11-21', '10:00')!
    expect(d.toISOString()).toBe('2026-11-21T13:00:00.000Z')
    expect(partesFormosa(d)).toEqual({ fecha: '2026-11-21', hora: '10:00' })
  })
  it('rechaza fechas u horas mal escritas', () => {
    expect(aInstante('21/11/2026', '10:00')).toBeNull()
    expect(aInstante('2026-11-21', '10')).toBeNull()
  })
  it('dice hoy, mañana o el día de la semana', () => {
    const ahora = aInstante('2026-11-19', '11:00')!
    expect(textoCuando(aInstante('2026-11-19', '19:00')!, ahora)).toBe('hoy a las 19:00')
    expect(textoCuando(aInstante('2026-11-20', '10:00')!, ahora)).toBe('mañana a las 10:00')
    expect(textoCuando(aInstante('2026-11-21', '10:00')!, ahora)).toBe('el sábado 21/11 a las 10:00')
    // Pasada la medianoche de Formosa (03:00 UTC) ya es otro día
    expect(textoCuando(aInstante('2026-11-20', '00:30')!, aInstante('2026-11-19', '23:50')!)).toBe('mañana a las 00:30')
  })
})

describe('texto del posteo', () => {
  it('cuenta emojis como una letra, hashtags y menciones', () => {
    const c = contarTexto('🧡 Hola #SaborYAroma #VidaSana @saboryaroma__ y mail a x@y.com #1')
    expect(c.hashtags).toBe(3)
    expect(c.menciones).toBe(1)
    expect(contarTexto('🧡a').letras).toBe(2)
  })
  it('frena texto vacío, largo o con demasiados hashtags', () => {
    expect(problemasDelTexto('  ')).toHaveLength(1)
    expect(problemasDelTexto('a'.repeat(2201))[0]).toMatch(/2201/)
    expect(problemasDelTexto(Array.from({ length: 31 }, (_, i) => `#h${i}`).join(' '))[0]).toMatch(/31 hashtags/)
    expect(problemasDelTexto('Todo bien #ok')).toEqual([])
  })
  it('arma el texto alternativo sin repetir y con «y» al final', () => {
    expect(textoAlternativo('carrusel', 'NutriOfertas 19/11', ['Pasta de maní', 'Almendras', 'Pasta de maní', 'Miel'])).toBe('NutriOfertas 19/11 de Sabor y Aroma con Pasta de maní, Almendras y Miel.')
    expect(textoAlternativo('promo', 'PROMOCIONES', [])).toBe('Promociones de Sabor y Aroma (PROMOCIONES).')
    expect([...textoAlternativo('carrusel', 'x', Array.from({ length: 300 }, (_, i) => `Producto número ${i}`))].length).toBeLessThanOrEqual(1000)
  })
})

describe('destinos', () => {
  const carrusel = [0, 1, 2, 3, 4].map((indice) => ({ indice, grupo: 'feed' as const }))
  const promo = [{ indice: 0, grupo: 'historia' as const }, { indice: 1, grupo: 'historia' as const }, { indice: 2, grupo: 'feed' as const }, { indice: 3, grupo: 'feed' as const }]

  it('un carrusel va en un solo posteo por red: primero Instagram', () => {
    expect(planDestinos(carrusel, [0, 1, 2, 3, 4], todos)).toEqual([
      { red: 'instagram', ubicacion: 'feed', placas: [0, 1, 2, 3, 4] },
      { red: 'facebook', ubicacion: 'feed', placas: [0, 1, 2, 3, 4] },
    ])
  })
  it('cada historia es un destino aparte (un reintento no repite las que salieron)', () => {
    const f = planDestinos(promo, [0, 1, 2, 3], { ...todos, feed: { instagram: true, facebook: false } })
    expect(f).toEqual([
      { red: 'instagram', ubicacion: 'feed', placas: [2, 3] },
      { red: 'instagram', ubicacion: 'historia', placas: [0] },
      { red: 'instagram', ubicacion: 'historia', placas: [1] },
      { red: 'facebook', ubicacion: 'historia', placas: [0] },
      { red: 'facebook', ubicacion: 'historia', placas: [1] },
    ])
  })
  it('saca las placas destildadas', () => {
    expect(planDestinos(carrusel, [0, 2], { ...todos, feed: { instagram: true, facebook: false } })).toEqual([{ red: 'instagram', ubicacion: 'feed', placas: [0, 2] }])
  })
  it('frena sin nada elegido o con más de 10 imágenes en Instagram', () => {
    expect(problemasDePlan(carrusel, [], todos)).toHaveLength(1)
    expect(problemasDePlan(carrusel, [0], { feed: { instagram: false, facebook: false }, historia: todos.historia })).toHaveLength(1)
    const once = Array.from({ length: 11 }, (_, indice) => ({ indice, grupo: 'feed' as const }))
    expect(problemasDePlan(once, once.map((p) => p.indice), todos)[0]).toMatch(/sacá 1/)
    expect(problemasDePlan(once, once.map((p) => p.indice), { ...todos, feed: { instagram: false, facebook: true } })).toEqual([])
  })
  it('solo historias no lleva texto', () => {
    expect(llevaTexto(promo, [0, 1], todos)).toBe(false)
    expect(llevaTexto(promo, [0, 2], todos)).toBe(true)
  })
})

describe('estado general', () => {
  it('resume los destinos', () => {
    expect(estadoGeneral(['ok', 'ok'])).toBe('publicada')
    expect(estadoGeneral(['ok', 'error'])).toBe('parcial')
    expect(estadoGeneral(['error', 'error'])).toBe('error')
    expect(estadoGeneral(['ok', 'pendiente'])).toBe('reintentando')
    expect(estadoGeneral(['cancelado', 'cancelado'])).toBe('cancelada')
    expect(estadoGeneral(['ok', 'cancelado'])).toBe('publicada')
  })
})

describe('cada cuánto mira Publicaciones si algo cambió', () => {
  const ahora = Date.parse('2026-11-24T12:00:00Z')
  const fila = (estado: 'programada' | 'publicando' | 'reintentando' | 'publicada', minutos: number | null, destinos: ('pendiente' | 'publicando' | 'ok')[] = ['pendiente']) =>
    ({ estado, sale: minutos == null ? null : new Date(ahora + minutos * 60_000).toISOString(), destinos: destinos.map((d) => ({ estado: d })) })
  it('nada en curso: no mira', async () => {
    const { cadaCuantoMirar } = await import('../reglas')
    expect(cadaCuantoMirar([fila('publicada', null, ['ok'])], ahora)).toBeNull()
    expect(cadaCuantoMirar([], ahora)).toBeNull()
  })
  it('publicando o reintentando: cada 5 s', async () => {
    const { cadaCuantoMirar, MIRAR_RAPIDO } = await import('../reglas')
    expect(cadaCuantoMirar([fila('publicando', 0)], ahora)).toBe(MIRAR_RAPIDO)
    expect(cadaCuantoMirar([fila('reintentando', 3)], ahora)).toBe(MIRAR_RAPIDO)
    expect(cadaCuantoMirar([fila('programada', 300, ['publicando'])], ahora)).toBe(MIRAR_RAPIDO)
  })
  it('programada: cada 5 s si falta poco, cada 30 s si sale en el día, nada si sale más adelante', async () => {
    const { cadaCuantoMirar, MIRAR_RAPIDO, MIRAR_LENTO } = await import('../reglas')
    expect(cadaCuantoMirar([fila('programada', 8)], ahora)).toBe(MIRAR_RAPIDO)
    expect(cadaCuantoMirar([fila('programada', -2)], ahora)).toBe(MIRAR_RAPIDO)
    expect(cadaCuantoMirar([fila('programada', 120)], ahora)).toBe(MIRAR_LENTO)
    expect(cadaCuantoMirar([fila('programada', 3 * 24 * 60)], ahora)).toBeNull()
  })
})
