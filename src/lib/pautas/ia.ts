import 'server-only'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { leerConfig } from '@/lib/configuracion'
import { OBJETIVOS_PAUTA, type ObjetivoPauta } from '@/lib/configuracion-tipos'
import { llamarClaude, ErrorIA } from '@/lib/ia/claude'
import { sistemaMarca } from '@/lib/ia/contexto'
import { clienteMeta } from '@/lib/meta/conexion'
import { leerPublicidad, topeDelMes } from './motor'
import { pesos, resultadoPrincipal } from './reglas'

const { publicaciones, publicacionDestinos, pautas } = esquema

export type SugerenciaPauta = { publicacionId: number; titulo: string; objetivo: ObjetivoPauta; porDia: number; dias: number; motivo: string }

/**
 * La IA elige qué posteo pautar y con cuánto, según cómo le fue sin pauta (me gusta y comentarios en Instagram),
 * lo que dieron las pautas anteriores y lo que queda del tope del mes. Solo sugiere: lanzar lo decide Lucas.
 */
export async function sugerirPauta(): Promise<SugerenciaPauta> {
  const [c, publicidad, tope] = await Promise.all([leerConfig(), leerPublicidad(), topeDelMes()])
  const desde = new Date(Date.now() - 45 * 864e5)
  const pubs = await db.select({ id: publicaciones.id, titulo: publicaciones.titulo, texto: publicaciones.texto }).from(publicaciones).where(and(inArray(publicaciones.estado, ['publicada', 'parcial']), gte(publicaciones.creadoEn, desde))).orderBy(desc(publicaciones.id)).limit(20)
  const ds = pubs.length ? await db.select().from(publicacionDestinos).where(and(inArray(publicacionDestinos.publicacionId, pubs.map((p) => p.id)), eq(publicacionDestinos.ubicacion, 'feed'), eq(publicacionDestinos.estado, 'ok'))) : []
  const candidatas = pubs.filter((p) => ds.some((d) => d.publicacionId === p.id))
  if (!candidatas.length) throw new ErrorIA('Todavía no hay posteos del feed publicados en los últimos 45 días para pautar.')
  const queda = Math.max(0, tope.tope - tope.comprometido)
  const minimo = publicidad?.minDiario ?? 1000
  if (tope.cortar && queda < minimo) throw new ErrorIA(`Queda ${pesos(queda)} del tope del mes: no alcanza para una pauta.`)

  // Cómo le fue a cada posteo en Instagram (me gusta y comentarios; si Meta no responde, se sigue sin el dato)
  let g: Awaited<ReturnType<typeof clienteMeta>>['g'] | null = null
  try { g = (await clienteMeta()).g } catch { /* sin conexión: sin números */ }
  const anteriores = await db.select().from(pautas).where(inArray(pautas.publicacionId, candidatas.map((p) => p.id)))
  const lineas: string[] = []
  for (const p of candidatas) {
    const ig = ds.find((d) => d.publicacionId === p.id && d.red === 'instagram')
    let numeros = 'sin datos de Instagram'
    if (ig?.metaId && g) {
      const m = await g.get<{ like_count?: number; comments_count?: number }>(ig.metaId, { fields: 'like_count,comments_count' }).catch(() => null)
      if (m) numeros = `${m.like_count ?? 0} me gusta, ${m.comments_count ?? 0} comentarios`
    }
    const prev = anteriores.filter((a) => a.publicacionId === p.id).map((a) => {
      const r = resultadoPrincipal(a.objetivo as ObjetivoPauta, a.gastado, a.resultados)
      return `ya pautada (${OBJETIVOS_PAUTA[a.objetivo as ObjetivoPauta]?.nombre ?? a.objetivo}, gastó ${pesos(a.gastado)}${r ? `, ${r.texto}${r.costo ? ` a ${r.costo}` : ''}` : ''})`
    })
    const fecha = ig?.publicadoEn ?? ds.find((d) => d.publicacionId === p.id)?.publicadoEn
    lineas.push(`- id ${p.id} · «${p.titulo}» · publicado ${fecha ? fecha.toISOString().slice(0, 10) : '?'} · ${ig ? 'en Instagram' : 'solo en Facebook'} · ${numeros}${prev.length ? ` · ${prev.join('; ')}` : ''} · texto: ${p.texto.slice(0, 160).replace(/\s+/g, ' ')}`)
  }

  const { json } = await llamarClaude<{ publicacionId: number; objetivo: string; porDia: number; dias: number; motivo: string }>({
    tipo: 'pauta',
    system: sistemaMarca(c),
    mensajes: [{
      role: 'user',
      content: `Ayudame a elegir qué posteo pautar en Meta esta semana y con cuánto.
Posteos publicados (elegí uno por su id):
${lineas.join('\n')}

Objetivos posibles: "mensajes" (WhatsApp, lo que más vende en el local), "trafico" (a la tienda online) o "alcance". Los posteos que salieron solo en Facebook solo pueden ir con "alcance".
Presupuesto: por día como mínimo ${pesos(minimo)}; lo habitual es ${pesos(c.pautas.porDia)} por día durante ${c.pautas.dias} días. Queda ${pesos(queda)} del tope del mes: por día × días no puede pasar eso.
Preferí el posteo que mejor funcionó sin pauta y que sea de productos o promos vigentes. En "motivo", explicale a Lucas en 1 o 2 oraciones (con voseo) por qué ese y por qué ese monto.`,
    }],
    esquema: {
      type: 'object',
      properties: {
        publicacionId: { type: 'integer' },
        objetivo: { type: 'string', enum: Object.keys(OBJETIVOS_PAUTA) },
        porDia: { type: 'integer' },
        dias: { type: 'integer' },
        motivo: { type: 'string' },
      },
      required: ['publicacionId', 'objetivo', 'porDia', 'dias', 'motivo'],
      additionalProperties: false,
    },
    maxTokens: 3000,
  })
  if (!json) throw new ErrorIA('La IA no devolvió una sugerencia. Probá de nuevo.')

  // Se revisa lo que propuso: un posteo de la lista, un objetivo posible y un monto dentro del tope
  const elegida = candidatas.find((p) => p.id === json.publicacionId) ?? candidatas[0]
  const conIg = ds.some((d) => d.publicacionId === elegida.id && d.red === 'instagram')
  let objetivo = (Object.keys(OBJETIVOS_PAUTA) as ObjetivoPauta[]).find((k) => k === json.objetivo) ?? c.pautas.objetivo
  if (!conIg) objetivo = 'alcance'
  let dias = Math.min(30, Math.max(1, Math.round(json.dias) || c.pautas.dias))
  let porDia = Math.max(minimo, Math.round((Number(json.porDia) || c.pautas.porDia) / 100) * 100)
  if (tope.cortar && porDia * dias > queda) {
    dias = Math.max(1, Math.floor(queda / porDia))
    if (porDia * dias > queda) porDia = Math.max(minimo, Math.floor(queda / dias / 100) * 100)
  }
  return { publicacionId: elegida.id, titulo: elegida.titulo, objetivo, porDia, dias, motivo: String(json.motivo ?? '').slice(0, 400) }
}
