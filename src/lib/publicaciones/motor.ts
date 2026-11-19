import 'server-only'
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import type { EstadoDestino } from '@/lib/db/esquema'
import { cola, COLA_PUBLICAR } from '@/lib/cola'
import { leerConfig } from '@/lib/configuracion'
import { MINUTOS_ENTRE_REINTENTOS } from '@/lib/configuracion-tipos'
import { encolarExportacion } from '@/lib/piezas/exportar'
import { clienteMeta, estadoMeta } from '@/lib/meta/conexion'
import { ErrorMeta } from '@/lib/meta/errores'
import { facebookFeed, facebookHistoria, instagramFeed, instagramHistoria } from '@/lib/meta/publicar'
import { cargarPieza, exportacionDe, type PiezaPublicar, type TipoPieza } from './piezas'
import { estadoGeneral, llevaTexto, MAX_DIAS_PROGRAMAR, planDestinos, problemasDelTexto, problemasDePlan, type DestinosElegidos } from './reglas'

const { publicaciones, publicacionDestinos, exportaciones, carruseles, promos } = esquema

// ---------------------------------------------------------------------------
// Crear (cuando Lucas aprueba en «Publicar»)
// ---------------------------------------------------------------------------
export type NuevaPublicacion = {
  tipo: TipoPieza
  id: number
  texto: string
  alt: string | null
  elegidas: number[]
  destinos: DestinosElegidos
  cuando: Date | null // null = ahora
}

/** Exportación al día de la pieza: si la última sigue igual se reusa; si no, se arma una nueva. */
async function prepararExportacion(pieza: PiezaPublicar): Promise<number> {
  const exp = await exportacionDe(pieza)
  if (exp?.alDia) return exp.id
  const id = await encolarExportacion(pieza.tipo, pieza.placas.map((p) => p.ruta), pieza.id, pieza.huella)
  if (pieza.tipo === 'carrusel') await db.update(carruseles).set({ exportacionId: id }).where(eq(carruseles.id, pieza.id))
  else await db.update(promos).set({ exportacionId: id }).where(eq(promos.id, pieza.id))
  return id
}

/** Revisa todo de nuevo en el servidor (la pantalla puede estar vieja) y crea la publicación. */
export async function crearPublicacion(n: NuevaPublicacion): Promise<{ id: number } | { error: string }> {
  const [pieza, meta, config] = await Promise.all([cargarPieza(n.tipo, n.id), estadoMeta(), leerConfig()])
  if (!pieza) return { error: 'Esa pieza ya no existe.' }
  if (!meta.conectada || !meta.cuentas) return { error: 'Meta no está conectado: cargá el token en Configuración › Meta.' }
  if (pieza.sinFoto.length) return { error: `No se puede publicar: ${pieza.sinFoto.map((x) => `«${x}»`).join(', ')} sin foto.` }
  if (pieza.bajas.length) return { error: `No se puede publicar: ${pieza.bajas.map((x) => `«${x}»`).join(', ')} ${pieza.bajas.length === 1 ? 'está dado' : 'están dados'} de baja en el ERP.` }

  const indices = new Set(pieza.placas.map((p) => p.indice))
  const elegidas = [...new Set((Array.isArray(n.elegidas) ? n.elegidas : []).filter((x) => Number.isInteger(x) && indices.has(x)))].sort((a, b) => a - b)
  const destinos: DestinosElegidos = {
    feed: { instagram: !!n.destinos?.feed?.instagram, facebook: !!n.destinos?.feed?.facebook },
    historia: { instagram: !!n.destinos?.historia?.instagram, facebook: !!n.destinos?.historia?.facebook },
  }
  const plan = problemasDePlan(pieza.placas, elegidas, destinos)
  if (plan.length) return { error: plan[0] }
  const texto = typeof n.texto === 'string' ? n.texto.trim() : ''
  const conTexto = llevaTexto(pieza.placas, elegidas, destinos)
  if (conTexto) {
    const p = problemasDelTexto(texto)
    if (p.length) return { error: p[0] }
  }
  const filas = planDestinos(pieza.placas, elegidas, destinos)
  if (filas.some((f) => f.red === 'instagram') && !meta.cuentas.instagramId) return { error: 'La página no tiene un Instagram de empresa vinculado: sacá Instagram o vinculalo en Meta.' }

  const ahora = Date.now()
  if (n.cuando) {
    const t = n.cuando.getTime()
    if (Number.isNaN(t)) return { error: 'Revisá el día y la hora.' }
    if (t < ahora + 2 * 60_000) return { error: 'Para programar, elegí una hora de acá a por lo menos 2 minutos (o publicá ahora).' }
    if (t > ahora + MAX_DIAS_PROGRAMAR * 864e5) return { error: `Se puede programar hasta ${MAX_DIAS_PROGRAMAR} días adelante.` }
  }

  let exportacionId: number
  try {
    exportacionId = await prepararExportacion(pieza)
  } catch {
    return { error: 'No se pudieron armar las imágenes. Probá de nuevo.' }
  }
  const alt = config.meta.textoAlt && typeof n.alt === 'string' && n.alt.trim() ? n.alt.trim().slice(0, 1000) : null
  const id = await db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(publicaciones)
      .values({ tipo: pieza.tipo, referenciaId: pieza.id, titulo: pieza.titulo, texto: conTexto ? texto : '', textoAlt: alt, exportacionId, programadaPara: n.cuando ?? new Date(), estado: 'programada' })
      .returning({ id: publicaciones.id })
    await tx.insert(publicacionDestinos).values(filas.map((f) => ({ ...f, publicacionId: id })))
    // El texto editado acá queda también en la pieza (la próxima vez sale igual)
    if (conTexto && texto !== pieza.texto.trim()) {
      if (pieza.tipo === 'carrusel') await tx.update(carruseles).set({ textoPosteo: texto }).where(eq(carruseles.id, pieza.id))
      else await tx.update(promos).set({ textoPosteo: texto }).where(eq(promos.id, pieza.id))
    }
    return id
  })
  if (!n.cuando) await despachar(id)
  return { id }
}

/** Manda a la cola una publicación que ya está para salir. */
async function despachar(id: number, segundos = 0) {
  try {
    await (await cola()).send(COLA_PUBLICAR, { id }, segundos ? { startAfter: segundos } : {})
  } catch (e) {
    // No pasa nada: la revisión de cada minuto la encuentra igual
    console.error('[publicar] no se pudo poner en la cola', e)
  }
}

// ---------------------------------------------------------------------------
// Publicar (lo hace la cola, a la hora programada)
// ---------------------------------------------------------------------------
const dudoso = 'Se cortó en el momento de publicar y no sabemos si salió. Fijate en Instagram o Facebook antes de reintentar.'

export async function ejecutarPublicacion(id: number) {
  // Se toma la publicación de forma atómica: si dos tareas llegan juntas, solo una la publica
  const [pub] = await db
    .update(publicaciones)
    .set({ estado: 'publicando' })
    .where(and(eq(publicaciones.id, id), inArray(publicaciones.estado, ['programada', 'reintentando']), sql`coalesce(${publicaciones.proximoIntento}, ${publicaciones.programadaPara}) <= now() + interval '5 seconds'`))
    .returning()
  if (!pub) return
  const estadoAnterior = pub.intentos > 0 ? 'reintentando' : 'programada'

  // Las imágenes: si la exportación todavía se está armando, se espera
  const [exp] = pub.exportacionId ? await db.select().from(exportaciones).where(eq(exportaciones.id, pub.exportacionId)) : []
  if (exp && (exp.estado === 'en_cola' || exp.estado === 'corriendo') && Date.now() - exp.creadoEn.getTime() < 15 * 60_000) {
    await db.update(publicaciones).set({ estado: estadoAnterior, proximoIntento: new Date(Date.now() + 10_000) }).where(eq(publicaciones.id, id))
    return
  }
  if (!exp || exp.estado !== 'ok') {
    await terminarTodo(id, `No se pudieron armar las imágenes${exp?.error ? ` (${exp.error})` : ''}. Tocá «Reintentar».`)
    return
  }

  const config = await leerConfig()
  const intento = pub.intentos + 1
  const quedan = intento < 1 + config.meta.reintentos
  await db.update(publicaciones).set({ intentos: intento }).where(eq(publicaciones.id, id))

  let meta: Awaited<ReturnType<typeof clienteMeta>>
  try {
    meta = await clienteMeta()
  } catch (e) {
    await terminarTodo(id, e instanceof Error ? e.message : 'Meta no está conectado.')
    return
  }
  const base = { ...meta, version: config.meta.versionApi }
  const url = (i: number) => (exp.archivos[i] ? `${config.meta.urlPublica}/media/${exp.archivos[i].split('/').map(encodeURIComponent).join('/')}` : null)

  const destinos = await db.select().from(publicacionDestinos).where(and(eq(publicacionDestinos.publicacionId, id), eq(publicacionDestinos.estado, 'pendiente'))).orderBy(asc(publicacionDestinos.id))
  let cortarCon: string | null = null
  for (const d of destinos) {
    if (cortarCon) {
      await db.update(publicacionDestinos).set({ estado: 'error', error: cortarCon }).where(eq(publicacionDestinos.id, d.id))
      continue
    }
    const urls = d.placas.map(url)
    if (urls.some((u) => !u)) {
      await db.update(publicacionDestinos).set({ estado: 'error', error: 'Faltan imágenes de la exportación. Tocá «Reintentar».' }).where(eq(publicacionDestinos.id, d.id))
      continue
    }
    await db.update(publicacionDestinos).set({ estado: 'publicando' }).where(eq(publicacionDestinos.id, d.id))
    try {
      const listas = urls as string[]
      const r =
        d.red === 'instagram'
          ? d.ubicacion === 'feed' ? await instagramFeed(base, listas, pub.texto, pub.textoAlt) : await instagramHistoria(base, listas[0])
          : d.ubicacion === 'feed' ? await facebookFeed(base, listas, pub.texto, pub.textoAlt) : await facebookHistoria(base, listas[0])
      await db.update(publicacionDestinos).set({ estado: 'ok', error: null, metaId: r.metaId, enlace: r.enlace, publicadoEn: new Date() }).where(eq(publicacionDestinos.id, d.id))
    } catch (e) {
      const em = e instanceof ErrorMeta ? e : null
      if (!em) console.error(`[publicar ${id}]`, e)
      const mensaje = em ? (em.dudoso ? dudoso : em.message) : 'Algo falló en la plataforma al publicar.'
      const reintentar = quedan && (em ? em.reintentable : true)
      await db.update(publicacionDestinos).set({ estado: reintentar ? 'pendiente' : 'error', error: mensaje }).where(eq(publicacionDestinos.id, d.id))
      // Si el problema es el token, no tiene sentido seguir con los demás
      if (em?.token) cortarCon = mensaje
    }
  }
  await cerrar(id)
}

/** Calcula el estado general; si quedan destinos pendientes, agenda el próximo reintento. */
async function cerrar(id: number) {
  const ds = await db.select({ estado: publicacionDestinos.estado }).from(publicacionDestinos).where(eq(publicacionDestinos.publicacionId, id))
  const estado = estadoGeneral(ds.map((d) => d.estado as EstadoDestino))
  if (estado === 'reintentando') {
    await db.update(publicaciones).set({ estado, proximoIntento: new Date(Date.now() + MINUTOS_ENTRE_REINTENTOS * 60_000) }).where(eq(publicaciones.id, id))
  } else {
    await db.update(publicaciones).set({ estado, proximoIntento: null, terminadoEn: new Date() }).where(eq(publicaciones.id, id))
  }
}

async function terminarTodo(id: number, error: string) {
  await db.update(publicacionDestinos).set({ estado: 'error', error }).where(and(eq(publicacionDestinos.publicacionId, id), inArray(publicacionDestinos.estado, ['pendiente', 'publicando'])))
  await cerrar(id)
}

// ---------------------------------------------------------------------------
// Revisión periódica y arranque
// ---------------------------------------------------------------------------

/** Busca lo que ya tiene que salir (programado o reintento) y lo manda a la cola. */
export async function revisarVencidas() {
  const vencidas = await db
    .select({ id: publicaciones.id })
    .from(publicaciones)
    .where(and(inArray(publicaciones.estado, ['programada', 'reintentando']), lte(sql`coalesce(${publicaciones.proximoIntento}, ${publicaciones.programadaPara})`, sql`now()`)))
    .limit(20)
  for (const v of vencidas) await despachar(v.id)
}

/** Si el servidor se reinició en medio de una publicación, lo que estaba saliendo queda como «no sabemos si salió». */
export async function recuperarAlArrancar() {
  await db.update(publicacionDestinos).set({ estado: 'error', error: dudoso }).where(eq(publicacionDestinos.estado, 'publicando'))
  const colgadas = await db.select({ id: publicaciones.id }).from(publicaciones).where(eq(publicaciones.estado, 'publicando'))
  for (const c of colgadas) {
    await db.update(publicaciones).set({ proximoIntento: new Date() }).where(eq(publicaciones.id, c.id))
    await cerrar(c.id)
  }
}

// ---------------------------------------------------------------------------
// Acciones de Lucas en el historial
// ---------------------------------------------------------------------------
export async function cancelarPublicacion(id: number): Promise<{ ok: true } | { error: string }> {
  const r = await db.transaction(async (tx) => {
    const [p] = await tx.update(publicaciones).set({ estado: 'cancelada' }).where(and(eq(publicaciones.id, id), inArray(publicaciones.estado, ['programada', 'reintentando']))).returning({ id: publicaciones.id })
    if (!p) return false
    await tx.update(publicacionDestinos).set({ estado: 'cancelado' }).where(and(eq(publicacionDestinos.publicacionId, id), eq(publicacionDestinos.estado, 'pendiente')))
    return true
  })
  if (!r) return { error: 'Ya no se puede cancelar: se está publicando o ya terminó.' }
  await cerrar(id)
  return { ok: true }
}

/** Vuelve a intentar solo lo que falló (lo que ya salió no se repite). */
export async function reintentarPublicacion(id: number): Promise<{ ok: true } | { error: string }> {
  const [pub] = await db.select().from(publicaciones).where(eq(publicaciones.id, id))
  if (!pub || !['error', 'parcial'].includes(pub.estado)) return { error: 'Esa publicación no tiene nada para reintentar.' }
  // Si las imágenes no se pudieron armar, se arman de nuevo
  const [exp] = pub.exportacionId ? await db.select({ estado: exportaciones.estado }).from(exportaciones).where(eq(exportaciones.id, pub.exportacionId)) : []
  let exportacionId = pub.exportacionId
  if (!exp || exp.estado === 'error') {
    const pieza = await cargarPieza(pub.tipo, pub.referenciaId)
    if (!pieza) return { error: 'La pieza ya no existe.' }
    if (pieza.sinFoto.length) return { error: `No se puede publicar: ${pieza.sinFoto.map((x) => `«${x}»`).join(', ')} sin foto.` }
    exportacionId = await prepararExportacion(pieza)
  }
  await db.transaction(async (tx) => {
    await tx.update(publicacionDestinos).set({ estado: 'pendiente', error: null }).where(and(eq(publicacionDestinos.publicacionId, id), eq(publicacionDestinos.estado, 'error')))
    await tx.update(publicaciones).set({ estado: 'programada', intentos: 0, programadaPara: new Date(), proximoIntento: null, terminadoEn: null, exportacionId }).where(eq(publicaciones.id, id))
  })
  await despachar(id)
  return { ok: true }
}
