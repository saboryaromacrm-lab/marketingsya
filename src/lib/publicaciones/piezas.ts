import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cargarCarrusel, htmlDePlaca, placasExportar } from '@/lib/carruseles/datos'
import { envolverHistoria } from '@/lib/carruseles/historia'
import { idsDe } from '@/lib/carruseles/tipos'
import { posteoCarrusel } from '@/lib/carruseles/posteo'
import { textoPosteo } from '@/lib/carruseles/textos'
import { cargarPromo, planDePlacas as placasPromo, rutaPlaca as rutaPromo } from '@/lib/promos/datos'
import { htmlFlyer } from '@/lib/promos/flyer'
import { textoVigencia } from '@/lib/promos/fechas'
import { leerConfig } from '@/lib/configuracion'
import { huellaDe } from '@/lib/piezas/huella'
import { urlMedia } from '@/lib/media'
import type { Grupo } from './reglas'

// Lo que hace falta saber de una pieza (carrusel o promo) para publicarla.

export type TipoPieza = 'carrusel' | 'promo'
export type PlacaPublicar = { indice: number; ruta: string; grupo: Grupo; formato: 'carrusel' | 'historia' | 'feed' | 'uno'; etiqueta: string }

export type PiezaPublicar = {
  tipo: TipoPieza
  id: number
  titulo: string
  subtitulo: string
  editar: string
  placas: PlacaPublicar[]
  huella: string
  // Texto del posteo: el que escribió Lucas en el editor, o el automático (el mismo que muestra el editor)
  texto: string
  nombres: string[]
  productos: number[]
  sinFoto: string[]
  bajas: string[]
}

export async function cargarPieza(tipo: TipoPieza, id: number): Promise<PiezaPublicar | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const config = await leerConfig()
  if (tipo === 'carrusel') {
    const c = await cargarCarrusel(id)
    if (!c) return null
    const plan = placasExportar(c)
    const ids = idsDe(c.carrusel.estilo, c.datos)
    const prods = ids.map((x) => c.productos.get(x)).filter((p) => !!p)
    const info = Object.fromEntries([...c.productos.values()].map((p) => [p.id, p]))
    return {
      tipo, id,
      titulo: c.carrusel.titulo,
      subtitulo: `Carrusel · ${plan.filter((p) => p.grupo === 'feed').length} placas${plan.some((p) => p.grupo === 'historia') ? ' + historias' : ''}`,
      editar: `/carruseles/${id}`,
      placas: plan.map((p, i) => ({ indice: i, ruta: p.ruta, grupo: p.grupo, formato: p.grupo === 'historia' ? 'historia' : 'carrusel', etiqueta: p.grupo === 'historia' ? `Historia ${p.numero}` : `${p.numero}` })),
      huella: huellaDe(plan.map((p) => { const h = htmlDePlaca(c, p.numero) ?? ''; return p.grupo === 'historia' ? envolverHistoria(h, c.carrusel.estilo, c.contacto) : h })),
      texto: c.carrusel.textoPosteo ?? posteoCarrusel(c.carrusel.estilo, c.datos, info, config.contacto, config.ia.hashtags),
      nombres: [...new Set(prods.map((p) => p.nombre))],
      productos: [...new Set(ids)],
      sinFoto: [...new Set(prods.filter((p) => !p.foto).map((p) => p.nombre))],
      bajas: [...new Set(prods.filter((p) => p.dadoDeBaja).map((p) => p.nombre))],
    }
  }
  const d = await cargarPromo(id)
  if (!d) return null
  const plan = placasPromo(d)
  const ids = [...new Set(d.filas.flatMap((f) => f.productos.map((p) => p.id)))]
  const prods = ids.map((x) => d.productos.get(x)).filter((p) => !!p)
  const vigencia = textoVigencia(d.promo.desde, d.promo.hasta).toLowerCase()
  const nombre = { historia: 'Historia', feed: 'Feed', uno: 'Uno' } as const
  return {
    tipo, id,
    titulo: `${d.promo.titulo} · ${vigencia}`,
    subtitulo: `Promo · ${plan.length} placas`,
    editar: `/promos/${id}`,
    placas: plan.map((p, i) => ({ indice: i, ruta: rutaPromo(id, p), grupo: p.formato === 'historia' ? 'historia' : 'feed', formato: p.formato, etiqueta: `${nombre[p.formato]} ${p.pagina}` })),
    huella: huellaDe(plan.map((p) => htmlFlyer(p.datos))),
    texto: d.promo.textoPosteo ?? textoPosteo('promo', { titulo: d.promo.titulo || 'PROMOCIONES', bajada: vigencia, productos: ids.slice(0, 8).map((x) => d.productos.get(x)?.nombre).filter((x): x is string => !!x), contacto: config.contacto, hashtags: config.ia.hashtags }),
    nombres: prods.map((p) => p.nombre),
    productos: ids,
    sinFoto: prods.filter((p) => !p.foto).map((p) => p.nombre),
    bajas: prods.filter((p) => p.dadoDeBaja).map((p) => p.nombre),
  }
}

/** La última exportación de la pieza y si sigue al día (misma huella, terminada bien y con todas las placas). */
export async function exportacionDe(pieza: PiezaPublicar) {
  const { exportaciones } = esquema
  const [x] = await db
    .select()
    .from(exportaciones)
    .where(and(eq(exportaciones.tipo, pieza.tipo), eq(exportaciones.referenciaId, pieza.id), isNull(exportaciones.formato)))
    .orderBy(desc(exportaciones.id))
    .limit(1)
  if (!x) return null
  const alDia = x.estado === 'ok' && x.huella === pieza.huella && x.archivos.length === pieza.placas.length
  return { id: x.id, estado: x.estado, terminadoEn: x.terminadoEn, alDia, imagenes: x.archivos.map(urlMedia) }
}

/** Si la pieza salió de una idea del calendario del asesor, el día de esa idea (para sugerirlo al programar). */
export async function diaDeLaIdea(tipo: TipoPieza, id: number): Promise<string | null> {
  const { iaIdeas } = esquema
  const semanas = await db.select({ datos: iaIdeas.datos }).from(iaIdeas).where(eq(iaIdeas.tipo, 'semana')).orderBy(desc(iaIdeas.creadoEn)).limit(12)
  for (const s of semanas) {
    const ideas = (s.datos as { ideas?: { dia?: string; borrador?: { tipo: string; id: number } | null }[] }).ideas ?? []
    const idea = ideas.find((i) => i.borrador?.tipo === tipo && i.borrador.id === id)
    if (idea?.dia) return idea.dia
  }
  return null
}
