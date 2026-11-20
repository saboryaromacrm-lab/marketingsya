import { describe, expect, it } from 'vitest'
import { CONFIG_INICIAL, limpiarConfig, limpiarPublico } from '@/lib/configuracion-tipos'
import {
  armarSegmentacion, aUnidadMinima, comprometidoDelMes, conImpuestos, diasEntre, enlaceTienda, estadoDesdeMeta, horarioMeta, pesos, problemasPresupuesto,
  resultadoPrincipal, resultadosDesdeInsight, resumenPublico, totalPauta,
} from '../reglas'

describe('fechas y montos', () => {
  it('cuenta los días con los dos extremos', () => {
    expect(diasEntre('2026-11-20', '2026-11-26')).toBe(7)
    expect(diasEntre('2026-11-20', '2026-11-20')).toBe(1)
    expect(diasEntre('2026-11-26', '2026-11-20')).toBe(0)
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(4)
  })
  it('total = por día × días; a Meta va en centavos; IVA aparte', () => {
    expect(totalPauta(3000, 7)).toBe(21000)
    expect(aUnidadMinima(21000)).toBe(2100000)
    expect(conImpuestos(21000, 21)).toBe(25410)
    expect(pesos(21000)).toBe('$ 21.000')
  })
  it('horario de Meta: hoy arranca ya; termina a las 23:59 de Formosa', () => {
    const ahora = new Date('2026-11-20T15:00:00Z')
    const h = horarioMeta('2026-11-20', '2026-11-26', ahora, '2026-11-20')
    expect(Date.parse(h.inicio)).toBeGreaterThan(ahora.getTime())
    expect(h.fin).toBe('2026-11-26T23:59:00-0300')
    expect(horarioMeta('2026-11-22', '2026-11-26', ahora, '2026-11-20').inicio).toBe('2026-11-22T00:00:00-0300')
  })
  it('frena fechas pasadas, al revés, muy largas o debajo del mínimo de Meta', () => {
    const base = { porDia: 3000, desde: '2026-11-20', hasta: '2026-11-26', hoy: '2026-11-20', minDiario: 1380 }
    expect(problemasPresupuesto(base)).toEqual([])
    expect(problemasPresupuesto({ ...base, desde: '2026-11-19' })[0]).toMatch(/ya pasó/)
    expect(problemasPresupuesto({ ...base, hasta: '2026-11-10' })[0]).toMatch(/anterior/)
    expect(problemasPresupuesto({ ...base, hasta: '2027-03-01' })[0]).toMatch(/90 días/)
    expect(problemasPresupuesto({ ...base, porDia: 1000 })[0]).toMatch(/\$ 1\.380/)
  })
})

describe('tope del mes', () => {
  it('las que pueden gastar cuentan por su total; las terminadas, por lo gastado', () => {
    const p = [
      { estado: 'activa' as const, total: 21000, gastado: 6000, mes: '2026-11' },
      { estado: 'terminada' as const, total: 15000, gastado: 14800, mes: '2026-11' },
      { estado: 'rechazada' as const, total: 10000, gastado: 0, mes: '2026-11' },
      { estado: 'pausada' as const, total: 8000, gastado: 1000, mes: '2026-11' },
      { estado: 'activa' as const, total: 50000, gastado: 0, mes: '2026-10' },
    ]
    expect(comprometidoDelMes(p, '2026-11')).toBe(21000 + 14800 + 0 + 8000)
  })
})

describe('estado desde Meta', () => {
  const r = { inicio: '2026-11-20T00:00:00-03:00', fin: '2026-11-26T23:59:00-03:00', ahora: new Date('2026-11-21T12:00:00Z') }
  it('traduce el estado del anuncio', () => {
    expect(estadoDesdeMeta({ ...r, anuncio: 'PENDING_REVIEW' })).toBe('en_revision')
    expect(estadoDesdeMeta({ ...r, anuncio: 'ACTIVE' })).toBe('activa')
    expect(estadoDesdeMeta({ ...r, anuncio: 'CAMPAIGN_PAUSED' })).toBe('pausada')
    expect(estadoDesdeMeta({ ...r, anuncio: 'DISAPPROVED' })).toBe('rechazada')
    expect(estadoDesdeMeta({ ...r, anuncio: 'WITH_ISSUES' })).toBe('con_problemas')
    expect(estadoDesdeMeta({ ...r, anuncio: 'ARCHIVED' })).toBe('terminada')
  })
  it('aprobada antes de empezar: programada; pasada la fecha de fin: terminada', () => {
    expect(estadoDesdeMeta({ ...r, anuncio: 'ACTIVE', ahora: new Date('2026-11-19T12:00:00Z') })).toBe('programada')
    expect(estadoDesdeMeta({ ...r, anuncio: 'ACTIVE', ahora: new Date('2026-11-27T12:00:00Z') })).toBe('terminada')
  })
})

describe('resultados', () => {
  it('lee gasto, alcance, clics y conversaciones de WhatsApp', () => {
    const r = resultadosDesdeInsight({ spend: '6120.5', reach: '9800', impressions: '15000', inline_link_clicks: '12', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '43' }] })
    expect(r.gastado).toBe(6120.5)
    expect(r.resultados).toEqual({ alcance: 9800, impresiones: 15000, clics: 12, mensajes: 43 })
    expect(resultadosDesdeInsight(null).gastado).toBe(0)
  })
  it('muestra el resultado principal según el objetivo, con su costo', () => {
    const res = { alcance: 9800, impresiones: 15000, clics: 702, mensajes: 43 }
    expect(resultadoPrincipal('mensajes', 6120, res)).toEqual({ texto: '43 mensajes', costo: '$ 142 c/u' })
    expect(resultadoPrincipal('trafico', 8110, res)?.costo).toBe('$ 11,55 c/u')
    expect(resultadoPrincipal('alcance', 9800, res)).toEqual({ texto: '9.800 personas', costo: '$ 1.000 cada mil' })
    expect(resultadoPrincipal('mensajes', 0, { ...res, mensajes: 0 })).toEqual({ texto: '0 mensajes', costo: null })
  })
})

describe('lo que se manda a Meta', () => {
  const [minorista, mayoristas] = CONFIG_INICIAL.pautas.publicos
  it('radio alrededor de Formosa, edades, Advantage+ y las ubicaciones de Instagram y Facebook', () => {
    const s = armarSegmentacion(minorista, 'ig_fb', { region: null, intereses: [{ id: '1', name: 'Vida saludable' }] })
    expect(s.geo_locations).toEqual({ custom_locations: [{ latitude: -26.1775, longitude: -58.1781, radius: 15, distance_unit: 'kilometer' }] })
    expect(s.age_min).toBe(18)
    expect(s.age_max).toBe(65)
    expect(s.publisher_platforms).toEqual(['facebook', 'instagram'])
    expect(s.instagram_positions).toEqual(['stream', 'story', 'reels'])
    expect(s.targeting_automation).toEqual({ advantage_audience: 1 })
    expect(s.flexible_spec).toEqual([{ interests: [{ id: '1', name: 'Vida saludable' }] }])
  })
  it('provincia por su clave de Meta; solo Instagram sin posiciones de Facebook', () => {
    const s = armarSegmentacion(mayoristas, 'ig', { region: { key: '123' }, intereses: [] })
    expect(s.geo_locations).toEqual({ regions: [{ key: '123' }] })
    expect(s.publisher_platforms).toEqual(['instagram'])
    expect('facebook_positions' in s).toBe(false)
    expect('flexible_spec' in s).toBe(false)
  })
  it('enlace a la tienda con la marca de seguimiento', () => {
    const u = new URL(enlaceTienda('tiendaonline.saboryaroma.com', 'NutriOfertas 19/11 · Tráfico', true))
    expect(u.origin).toBe('https://tiendaonline.saboryaroma.com')
    expect(u.searchParams.get('utm_source')).toBe('meta')
    expect(u.searchParams.get('utm_campaign')).toBe('nutriofertas-19-11-trafico')
    expect(enlaceTienda('tiendaonline.saboryaroma.com', 'x', false)).toBe('https://tiendaonline.saboryaroma.com')
  })
  it('resume el público en una línea', () => {
    expect(resumenPublico(minorista)).toMatch(/^Formosa Capital y 15 km alrededor · 18 a 65\+ · todos los géneros · Meta amplía/)
    expect(resumenPublico(mayoristas)).toMatch(/^Provincia de Formosa · 25 a 65\+/)
  })
})

describe('configuración de pautas', () => {
  it('con Advantage+ la edad máxima queda en 65+ y la mínima hasta 25', () => {
    const p = limpiarPublico({ nombre: 'Jóvenes', zona: { tipo: 'radio', nombre: 'Centro', lat: -26.18, lng: -58.17, km: 5 }, edadMin: 30, edadMax: 40, advantage: true })!
    expect(p.edadMin).toBe(25)
    expect(p.edadMax).toBe(65)
    expect(p.id).toBe('jovenes')
    const sin = limpiarPublico({ nombre: 'X', zona: { tipo: 'region', nombre: 'Chaco' }, edadMin: 30, edadMax: 40, advantage: false })!
    expect([sin.edadMin, sin.edadMax]).toEqual([30, 40])
  })
  it('descarta públicos sin nombre o sin zona y nunca queda sin públicos', () => {
    expect(limpiarPublico({ nombre: '', zona: { tipo: 'region', nombre: 'Formosa' } })).toBeNull()
    expect(limpiarPublico({ nombre: 'X', zona: { tipo: 'radio' } })).toBeNull()
    const c = limpiarConfig({ pautas: { publicos: [], publicoEntrada: 'nada', topeMensual: '150.000', objetivo: 'raro' } })
    expect(c.pautas.publicos.length).toBe(2)
    expect(c.pautas.publicoEntrada).toBe('minorista')
    expect(c.pautas.objetivo).toBe('mensajes')
  })
})
