import 'server-only'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import type { Config } from '@/lib/configuracion-tipos'
import { hoyFormosa, sumarDias } from '@/lib/promos/fechas'
import { pesosPromo } from '@/lib/promos/calculo'
import { estacion, proximasFechas } from './fechas-especiales'

const { productos, sincronizacionCambios, sincronizaciones, promos, promoFilas, carruseles } = esquema

// Categorías que no van en recetas
const NO_RECETAS = new Set(['Suplementos', 'Herboristería', 'Cuidado Personal', 'Varios'])

/** Instrucciones fijas de la marca (van al caché de Anthropic: cambian solo si Lucas cambia la configuración). */
export function sistemaMarca(c: Config): string {
  const emojis = { ninguno: 'No uses emojis.', pocos: 'Usá pocos emojis (uno o dos por texto, nunca en cada renglón).', mas: 'Podés usar emojis con soltura, sin recargar.' }[c.ia.emojis]
  return `Sos el asesor de marketing de Sabor y Aroma, una distribuidora y dietética de productos saludables de Formosa Capital (Argentina), con 4 sucursales.
Vende a minorista y a mayorista. Tienda online: ${c.contacto.web} (sin mínimo de compra, se entra con WhatsApp). WhatsApp ${c.contacto.whatsapp}. Instagram ${c.contacto.instagram}.
Le hablás a Lucas, el dueño. Proponés ideas, textos y contenido; nunca publicás nada ni cambiás precios: él revisa y aprueba todo.

Voz de la marca: ${c.ia.tono}
Escribís siempre en español rioplatense, con voseo («elegí», «probá», «aprovechá»). ${emojis}
Slogans aprobados (usalos tal cual, sin cambiarles nada): ${c.ia.slogans.map((s) => `«${s}»`).join(' · ')}.
Hashtags fijos de la marca: ${c.ia.hashtags.join(' ')}.

Reglas que no se rompen:
- La marca se escribe «Sabor y Aroma» (nunca «Sabor Y Aroma», «Sabor & Aroma» ni «Aroma y Sabor»).
- No prometas propiedades medicinales ni resultados. Nunca uses estas palabras o ideas: ${c.ia.prohibidas.map((p) => `«${p}»`).join(', ')}. Hablá de beneficios generales y comprobables («aporta fibra», «proteínas vegetales», «grasas buenas»).
- Solo productos saludables: no propongas gaseosas ni golosinas comunes.
- No inventes precios ni descuentos: los calcula la plataforma.
- Usá solo productos de la lista que te pasan, por su número (id). No inventes productos.`
}

export type Candidato = { id: number; nombre: string; categoria: string | null; precio: number | null; granel: boolean; senales: string[] }

/** Productos que se pueden usar en piezas (activos, con foto, no excluidos), con lo que los hace interesantes hoy. */
export async function candidatos(c: Config, opciones: { limite: number; paraRecetas?: boolean; prioridad?: number[] }): Promise<Candidato[]> {
  const hoy = hoyFormosa()
  const desde = new Date(`${sumarDias(hoy, -30)}T03:00:00Z`)
  const lista = String(c.piezas.listaId)
  const base = await db
    .select({
      id: productos.id,
      nombre: sql<string>`coalesce(${productos.nombrePiezas}, ${productos.nombreSugerido})`,
      categoria: productos.categoria,
      tipo: productos.tipo,
      precio: sql<number | null>`(${productos.preciosLista} -> ${lista} ->> 'precio')::float`,
    })
    .from(productos)
    .where(and(eq(productos.dadoDeBaja, false), eq(productos.excluirDePiezas, false), sql`${fotoEfectiva} is not null`))

  // Señales: altas recientes (sin contar la primera importación), bajas de precio y uso reciente en piezas
  const [primera] = await db.select({ id: sql<number>`min(${sincronizaciones.id})` }).from(sincronizaciones)
  const cambios = await db
    .select({ id: sincronizacionCambios.entidadId, tipo: sincronizacionCambios.tipo, antes: sincronizacionCambios.antes, despues: sincronizacionCambios.despues, sinc: sincronizacionCambios.sincronizacionId })
    .from(sincronizacionCambios)
    .innerJoin(sincronizaciones, eq(sincronizaciones.id, sincronizacionCambios.sincronizacionId))
    .where(and(eq(sincronizacionCambios.entidad, 'producto'), gte(sincronizaciones.creadoEn, desde), sql`${sincronizacionCambios.tipo} in ('alta', 'precio')`))
  const nuevos = new Set(cambios.filter((x) => x.tipo === 'alta' && x.sinc !== primera?.id).map((x) => x.id))
  const bajaron = new Map<number, number>()
  for (const x of cambios.filter((y) => y.tipo === 'precio')) {
    const a = Object.values((x.antes ?? {}) as Record<string, number>)[0]
    const d = Object.values((x.despues ?? {}) as Record<string, number>)[0]
    if (a && d && d < a) bajaron.set(x.id, Math.round((1 - d / a) * 100))
  }
  const usados = await usadosHacePoco(c.ia.criterios.diasSinUsar)

  const prioridad = new Set(opciones.prioridad ?? [])
  const todos: Candidato[] = base
    .filter((p) => !opciones.paraRecetas || !NO_RECETAS.has(p.categoria ?? ''))
    .map((p) => {
      const senales: string[] = []
      if (c.ia.criterios.nuevos && nuevos.has(p.id)) senales.push('nuevo en el catálogo')
      if (c.ia.criterios.bajaron && bajaron.has(p.id)) senales.push(`bajó ${bajaron.get(p.id)} % de precio`)
      if (usados.has(p.id)) senales.push('salió hace poco en una pieza')
      else if (c.ia.criterios.sinUsar) senales.push(`no salió en piezas en los últimos ${c.ia.criterios.diasSinUsar} días`)
      return { id: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio, granel: p.tipo === 'granel', senales }
    })
  // Primero los pedidos y los que tienen novedades; el resto, repartido entre categorías (cambia cada día)
  const destacados = todos.filter((p) => prioridad.has(p.id) || p.senales.some((s) => s.startsWith('nuevo') || s.startsWith('bajó')))
  const resto = todos.filter((p) => !destacados.includes(p))
  const semilla = Number(hoy.replace(/-/g, ''))
  resto.sort((a, b) => ((a.id * 9301 + semilla) % 233280) - ((b.id * 9301 + semilla) % 233280))
  const porCategoria = new Map<string, Candidato[]>()
  for (const p of resto) {
    const k = p.categoria ?? 'Sin categoría'
    porCategoria.set(k, [...(porCategoria.get(k) ?? []), p])
  }
  const elegidos = [...destacados]
  while (elegidos.length < opciones.limite && [...porCategoria.values()].some((l) => l.length)) {
    for (const l of porCategoria.values()) {
      const p = l.shift()
      if (p) elegidos.push(p)
      if (elegidos.length >= opciones.limite) break
    }
  }
  return elegidos.slice(0, Math.max(opciones.limite, destacados.length))
}

/** Productos que salieron en promos o carruseles modificados en los últimos `dias` días. */
async function usadosHacePoco(dias: number): Promise<Set<number>> {
  const desde = new Date(Date.now() - dias * 86_400_000)
  const [filas, cars] = await Promise.all([
    db.select({ productos: promoFilas.productos }).from(promoFilas).innerJoin(promos, eq(promos.id, promoFilas.promoId)).where(gte(promos.actualizadoEn, desde)),
    db.select({ datos: carruseles.datos }).from(carruseles).where(gte(carruseles.actualizadoEn, desde)),
  ])
  const ids = new Set<number>()
  for (const f of filas) for (const p of f.productos) ids.add(p.id)
  for (const c of cars) JSON.stringify(c.datos, (k, v) => { if ((k === 'id' || k === 'producto' || k === 'foto') && typeof v === 'number') ids.add(v); return v })
  return ids
}

export function listaCandidatos(cs: Candidato[], conPrecio = true): string {
  return cs
    .map((p) => [p.id, p.nombre, p.categoria ?? 'Sin categoría', conPrecio ? (p.precio != null ? `${pesosPromo(p.precio)}${p.granel ? ' el kg' : ''}` : 'sin precio') : null, p.senales.join(', ')].filter((x) => x !== null && x !== '').join(' | '))
    .join('\n')
}

/** Hoy, la estación y las fechas especiales que se vienen (si están activadas). */
export function momento(c: Config, dias = 30): string {
  const hoy = hoyFormosa()
  const f = c.ia.fechasEspeciales ? proximasFechas(hoy, dias) : []
  const fechas = f.length ? `Fechas especiales que se vienen: ${f.map((x) => `${x.fecha.slice(8, 10)}/${x.fecha.slice(5, 7)} ${x.nombre} (${x.idea})`).join('; ')}.` : ''
  return `Hoy es ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}/${hoy.slice(0, 4)}${c.ia.criterios.epoca ? `, ${estacion(hoy)} en Argentina (Formosa es muy calurosa en verano)` : ''}. ${fechas}`.trim()
}
