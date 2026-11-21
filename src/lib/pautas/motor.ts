import 'server-only'
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import type { EstadoPauta } from '@/lib/db/esquema'
import { guardarAjuste, leerAjuste } from '@/lib/ajustes'
import { leerConfig } from '@/lib/configuracion'
import { OBJETIVOS_PAUTA, type ObjetivoPauta } from '@/lib/configuracion-tipos'
import { hoyFormosa } from '@/lib/promos/fechas'
import { urlMedia } from '@/lib/media'
import { clienteMeta, estadoMeta } from '@/lib/meta/conexion'
import { ErrorMeta } from '@/lib/meta/errores'
import { buscarIntereses, buscarRegion, cambiarEstadoCampana, cambiarPresupuestoConjunto, crearCampana, detectarPublicidad, leerAnuncio, leerResultados, type Publicidad } from '@/lib/meta/anuncios'
import {
  armarSegmentacion, aUnidadMinima, comprometidoDelMes, diasEntre, enlaceTienda, ESTADO_FINAL, estadoDesdeMeta, gastadoDelMes, horarioMeta, META_OBJETIVO, pesos,
  problemasPresupuesto, resultadosDesdeInsight, totalPauta,
} from './reglas'

const { pautas, publicaciones, publicacionDestinos, exportaciones } = esquema
const MINUTOS_CACHE = 15

type R<T = object> = ({ ok: true } & T) | { error: string }
const mensaje = (e: unknown) => (e instanceof ErrorMeta ? e.message : e instanceof Error ? e.message : 'Algo falló al hablar con Meta.')

// ---------------------------------------------------------------------------
// Cuenta publicitaria
// ---------------------------------------------------------------------------
export async function leerPublicidad(): Promise<Publicidad | null> {
  const v = await leerAjuste('meta_publicidad')
  if (!v) return null
  try { return JSON.parse(v) as Publicidad } catch { return null }
}

/** Busca la cuenta publicitaria con el token de Meta y la guarda. */
export async function detectarYGuardar(preferida?: string | null): Promise<R<{ publicidad: Publicidad }>> {
  try {
    const { g, cuentas } = await clienteMeta()
    const publicidad = await detectarPublicidad(g, cuentas, preferida ?? (await leerPublicidad())?.id)
    await guardarAjuste('meta_publicidad', JSON.stringify(publicidad))
    return { ok: true, publicidad }
  } catch (e) {
    return { error: mensaje(e) }
  }
}

export const mesDe = (fecha: string) => fecha.slice(0, 7)

/** Tope del mes: lo comprometido (las que pueden gastar, por su total) y lo gastado de verdad. */
export async function topeDelMes(mes = mesDe(hoyFormosa())) {
  const config = await leerConfig()
  const filas = await db.select({ id: pautas.id, estado: pautas.estado, total: pautas.total, gastado: pautas.gastado, mes: pautas.mes }).from(pautas).where(eq(pautas.mes, mes))
  return { tope: config.pautas.topeMensual, cortar: config.pautas.cortar, comprometido: comprometidoDelMes(filas, mes), gastado: gastadoDelMes(filas, mes), filas }
}

// ---------------------------------------------------------------------------
// Lo que se puede promocionar: publicaciones del feed que ya salieron
// ---------------------------------------------------------------------------
export type Promocionable = {
  id: number
  titulo: string
  texto: string
  imagen: string | null
  publicadaEn: Date | null
  instagram: { media: string; enlace: string | null } | null
  facebook: { post: string; enlace: string | null } | null
}

export async function promocionable(publicacionId: number): Promise<Promocionable | null> {
  const [pub] = await db.select().from(publicaciones).where(eq(publicaciones.id, publicacionId))
  if (!pub) return null
  // Feed o reel de Instagram (los reels también se pueden promocionar); de Facebook, solo posteos del feed
  const ds = await db.select().from(publicacionDestinos).where(and(eq(publicacionDestinos.publicacionId, publicacionId), inArray(publicacionDestinos.ubicacion, ['feed', 'reel']), eq(publicacionDestinos.estado, 'ok')))
  const ig = ds.find((d) => d.red === 'instagram' && d.metaId)
  const fb = ds.find((d) => d.red === 'facebook' && d.ubicacion === 'feed' && d.metaId && pub.formato === 'imagenes')
  if (!ig && !fb) return null
  const [exp] = pub.exportacionId ? await db.select({ archivos: exportaciones.archivos }).from(exportaciones).where(eq(exportaciones.id, pub.exportacionId)) : []
  const primera = pub.formato !== 'imagenes' ? 1 : (ig ?? fb)!.placas[0] ?? 0
  return {
    id: pub.id,
    titulo: pub.titulo,
    texto: pub.texto,
    imagen: exp?.archivos[primera] ? urlMedia(exp.archivos[primera]) : null,
    publicadaEn: (ig ?? fb)!.publicadoEn,
    instagram: ig ? { media: ig.metaId!, enlace: ig.enlace } : null,
    facebook: fb ? { post: fb.metaId!, enlace: fb.enlace } : null,
  }
}

/** Lo que impide lanzar con este objetivo (los botones de WhatsApp y de la tienda solo se pueden sumar a un posteo de Instagram). */
export function problemasOrigen(p: Promocionable, objetivo: ObjetivoPauta): string[] {
  if (objetivo !== 'alcance' && !p.instagram) return ['Para «Mensajes» o «Tráfico» el posteo tiene que haber salido en Instagram (a un posteo de Facebook no se le puede sumar el botón). Elegí «Alcance».']
  return []
}

// ---------------------------------------------------------------------------
// Lanzar
// ---------------------------------------------------------------------------
export type NuevaPauta = { publicacionId: number; objetivo: ObjetivoPauta; publicoId: string; porDia: number; desde: string; hasta: string; confirmado: number }

export async function crearPauta(n: NuevaPauta): Promise<R<{ id: number }>> {
  const [config, meta, publicidad] = await Promise.all([leerConfig(), estadoMeta(), leerPublicidad()])
  if (!meta.conectada || !meta.cuentas) return { error: 'Meta no está conectado: cargá el token en Configuración › Meta.' }
  if (!publicidad) return { error: 'Falta detectar la cuenta publicitaria en Configuración › Pautas.' }
  if (publicidad.moneda !== 'ARS') return { error: `La cuenta publicitaria está en ${publicidad.moneda}: la plataforma trabaja en pesos. Usá una cuenta en pesos argentinos.` }
  if (!(n.objetivo in OBJETIVOS_PAUTA)) return { error: 'Objetivo desconocido.' }
  const publico = config.pautas.publicos.find((x) => x.id === n.publicoId)
  if (!publico) return { error: 'Ese público ya no existe: elegí otro.' }
  const p = await promocionable(Number(n.publicacionId))
  if (!p) return { error: 'Esa publicación no tiene un posteo del feed publicado para promocionar.' }
  const origen = problemasOrigen(p, n.objetivo)
  if (origen.length) return { error: origen[0] }

  const hoy = hoyFormosa()
  const porDia = Math.round(Number(n.porDia))
  const pres = problemasPresupuesto({ porDia, desde: n.desde, hasta: n.hasta, hoy, minDiario: publicidad.minDiario })
  if (pres.length) return { error: pres[0] }
  const total = totalPauta(porDia, diasEntre(n.desde, n.hasta))
  // Lo que confirmó Lucas tiene que ser exactamente lo que se manda (si la pantalla quedó vieja, se vuelve a confirmar)
  if (Math.round(Number(n.confirmado)) !== total) return { error: `El monto cambió: ahora el máximo es ${pesos(total)}. Confirmalo de nuevo.` }
  const mes = mesDe(n.desde)
  const t = await topeDelMes(mes)
  if (t.cortar && t.comprometido + total > t.tope) return { error: `Con esta pauta te pasás del tope del mes: ya hay ${pesos(t.comprometido)} comprometidos de ${pesos(t.tope)}. Bajá el monto o subí el tope en Configuración › Pautas.` }

  // Doble clic: si ya se está creando una pauta para esta publicación, no se crea otra
  const [enCurso] = await db.select({ id: pautas.id }).from(pautas).where(and(eq(pautas.publicacionId, p.id), eq(pautas.estado, 'creando'), gte(pautas.creadoEn, new Date(Date.now() - 3 * 60_000))))
  if (enCurso) return { error: 'Ya se está creando una pauta para esta publicación.' }

  const objetivo = META_OBJETIVO[n.objetivo]
  const nombre = `${p.titulo.slice(0, 60)} · ${OBJETIVOS_PAUTA[n.objetivo].nombre} · ${n.desde.slice(8, 10)}/${n.desde.slice(5, 7)}`
  const [{ id }] = await db
    .insert(pautas)
    .values({
      publicacionId: p.id, titulo: p.titulo, objetivo: n.objetivo, publicoNombre: publico.nombre, publico: publico as unknown as Record<string, unknown>, ubicaciones: config.pautas.ubicaciones,
      origen: p.instagram ? 'instagram' : 'facebook', porDia, desde: n.desde, hasta: n.hasta, total, mes, estado: 'creando',
    })
    .returning({ id: pautas.id })

  try {
    const { g } = await clienteMeta()
    const region = publico.zona.tipo === 'region' ? await buscarRegion(g, publico.zona.nombre) : null
    if (publico.zona.tipo === 'region' && !region) throw new ErrorMeta({ mensaje: `Meta no encontró la zona «${publico.zona.nombre}». Revisá el público en Configuración › Pautas.`, reintentable: false })
    const intereses = publico.intereses.length ? await buscarIntereses(g, publico.intereses) : []
    const { inicio, fin } = horarioMeta(n.desde, n.hasta, new Date(), hoy)
    const llamado =
      n.objetivo === 'mensajes' ? { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } }
        : n.objetivo === 'trafico' ? { type: 'SHOP_NOW', value: { link: enlaceTienda(config.contacto.web, nombre, config.pautas.utm) } }
          : null
    const r = await crearCampana(g, {
      cuenta: publicidad.id,
      nombre,
      objetivo: objetivo.objetivo,
      optimizacion: objetivo.optimizacion,
      destino: objetivo.destino,
      presupuesto: aUnidadMinima(total),
      inicio,
      fin,
      segmentacion: armarSegmentacion(publico, config.pautas.ubicaciones, { region, intereses }),
      paginaId: meta.cuentas.paginaId,
      creativo: {
        instagram: p.instagram && meta.cuentas.instagramId ? { usuario: meta.cuentas.instagramId, media: p.instagram.media } : null,
        facebookPost: p.facebook?.post ?? null,
        llamado,
      },
    })
    await db
      .update(pautas)
      .set({ estado: 'en_revision', metaCampana: r.campana, metaConjunto: r.conjunto, metaCreativo: r.creativo, metaAnuncio: r.anuncio, motivo: r.dudosa ? 'Se cortó la conexión al activarla: tocá «Actualizar ahora» para confirmar su estado.' : null })
      .where(eq(pautas.id, id))
    return { ok: true, id }
  } catch (e) {
    if (!(e instanceof ErrorMeta)) console.error(`[pauta ${id}]`, e)
    await db.update(pautas).set({ estado: 'error', motivo: mensaje(e), terminadoEn: new Date() }).where(eq(pautas.id, id))
    return { error: mensaje(e) }
  }
}

// ---------------------------------------------------------------------------
// Estado y resultados (se piden a Meta cada 15 minutos como mucho, salvo «Actualizar ahora»)
// ---------------------------------------------------------------------------
export async function sincronizarPautas(forzar = false): Promise<{ actualizadas: number; error: string | null }> {
  const limite = new Date(Date.now() - MINUTOS_CACHE * 60_000)
  const vivas: EstadoPauta[] = ['en_revision', 'programada', 'activa', 'pausada', 'con_problemas']
  const filas = await db
    .select()
    .from(pautas)
    .where(
      and(
        sql`${pautas.metaCampana} is not null`,
        or(
          inArray(pautas.estado, vivas),
          // Las recién terminadas: una última lectura para tener lo gastado final
          and(eq(pautas.estado, 'terminada'), or(isNull(pautas.sincronizadoEn), lt(pautas.sincronizadoEn, sql`${pautas.terminadoEn} + interval '1 day'`))),
        ),
        forzar ? undefined : or(isNull(pautas.sincronizadoEn), lt(pautas.sincronizadoEn, limite)),
      ),
    )
    .orderBy(desc(pautas.id))
    .limit(40)
  if (!filas.length) return { actualizadas: 0, error: null }
  let cliente: Awaited<ReturnType<typeof clienteMeta>>
  try {
    cliente = await clienteMeta()
  } catch (e) {
    return { actualizadas: 0, error: mensaje(e) }
  }
  let actualizadas = 0
  let error: string | null = null
  for (const p of filas) {
    try {
      const [anuncio, insight] = await Promise.all([leerAnuncio(cliente.g, p.metaAnuncio!), leerResultados(cliente.g, p.metaCampana!)])
      const { inicio, fin } = { inicio: `${p.desde}T00:00:00-03:00`, fin: `${p.hasta}T23:59:00-03:00` }
      const nuevo = p.estado === 'terminada' ? 'terminada' : estadoDesdeMeta({ anuncio: anuncio.estado, inicio, fin })
      const leido = resultadosDesdeInsight(insight)
      // Lo gastado nunca baja: si Meta devuelve una lectura vacía o atrasada, queda lo último que se supo
      const gastado = Math.max(p.gastado, leido.gastado)
      const resultados = insight ? leido.resultados : (p.resultados ?? leido.resultados)
      const motivo = nuevo === 'rechazada' ? anuncio.rechazo ?? 'Meta no dio el motivo.' : nuevo === 'con_problemas' ? anuncio.problema : null
      await db
        .update(pautas)
        .set({ estado: nuevo, motivo, gastado, resultados, sincronizadoEn: new Date(), terminadoEn: ESTADO_FINAL(nuevo) ? (p.terminadoEn ?? new Date()) : null })
        .where(eq(pautas.id, p.id))
      actualizadas++
    } catch (e) {
      error = mensaje(e)
      if (e instanceof ErrorMeta && e.token) break
    }
  }
  return { actualizadas, error }
}

export async function ultimaSincronizacion(): Promise<Date | null> {
  const [r] = await db.select({ en: sql<Date | null>`max(${pautas.sincronizadoEn})` }).from(pautas)
  return r?.en ? new Date(r.en) : null
}

// ---------------------------------------------------------------------------
// Acciones de Lucas
// ---------------------------------------------------------------------------
export async function accionPauta(id: number, accion: 'pausar' | 'reanudar' | 'terminar'): Promise<R> {
  const [p] = await db.select().from(pautas).where(eq(pautas.id, id))
  if (!p || !p.metaCampana) return { error: 'Esa pauta no existe en Meta.' }
  if (ESTADO_FINAL(p.estado)) return { error: 'Esa pauta ya terminó.' }
  if (accion === 'reanudar') {
    const t = await topeDelMes(p.mes)
    // Al reanudar puede volver a gastar todo su total: ya está contado en lo comprometido
    if (t.cortar && t.comprometido > t.tope) return { error: 'Se pasa del tope del mes: subí el tope en Configuración › Pautas para reanudarla.' }
  }
  try {
    const { g } = await clienteMeta()
    await cambiarEstadoCampana(g, p.metaCampana, accion === 'pausar' ? 'PAUSED' : accion === 'reanudar' ? 'ACTIVE' : 'ARCHIVED')
    if (accion === 'terminar') await db.update(pautas).set({ estado: 'terminada', motivo: 'La terminaste antes de tiempo.', terminadoEn: new Date() }).where(eq(pautas.id, id))
    else await db.update(pautas).set({ estado: accion === 'pausar' ? 'pausada' : 'activa', sincronizadoEn: null }).where(eq(pautas.id, id))
    await sincronizarPautas(true)
    return { ok: true }
  } catch (e) {
    return { error: mensaje(e) }
  }
}

/** Cambiar cuánto por día y hasta cuándo. El nuevo total se confirma igual que al lanzar. */
export async function cambiarPresupuesto(id: number, porDiaIn: number, hasta: string, confirmado: number): Promise<R<{ total: number }>> {
  const [p] = await db.select().from(pautas).where(eq(pautas.id, id))
  if (!p || !p.metaConjunto) return { error: 'Esa pauta no existe en Meta.' }
  if (ESTADO_FINAL(p.estado)) return { error: 'Esa pauta ya terminó.' }
  const publicidad = await leerPublicidad()
  const porDia = Math.round(Number(porDiaIn))
  const hoy = hoyFormosa()
  if (hasta < hoy) return { error: 'La fecha de fin ya pasó.' }
  const pres = problemasPresupuesto({ porDia, desde: p.desde, hasta, hoy: p.desde, minDiario: publicidad?.minDiario ?? null })
  if (pres.length) return { error: pres[0] }
  const total = totalPauta(porDia, diasEntre(p.desde, hasta))
  if (total <= p.gastado) return { error: `Ya gastó ${pesos(p.gastado)}: el nuevo total tiene que ser mayor.` }
  if (Math.round(Number(confirmado)) !== total) return { error: `El monto cambió: ahora el máximo es ${pesos(total)}. Confirmalo de nuevo.` }
  const t = await topeDelMes(p.mes)
  const otras = comprometidoDelMes(t.filas, p.mes, (x) => (x as { id?: number }).id === p.id)
  if (t.cortar && otras + total > t.tope) return { error: `Con ese monto te pasás del tope del mes (${pesos(t.tope)}). Bajalo o subí el tope en Configuración › Pautas.` }
  try {
    const { g } = await clienteMeta()
    await cambiarPresupuestoConjunto(g, p.metaConjunto, aUnidadMinima(total), `${hasta}T23:59:00-0300`)
    await db.update(pautas).set({ porDia, hasta, total, sincronizadoEn: null }).where(eq(pautas.id, id))
    return { ok: true, total }
  } catch (e) {
    return { error: mensaje(e) }
  }
}

/** Para Inicio: gasto del mes contra el tope, las activas y las rechazadas de la última semana. */
export async function resumenPautas() {
  const t = await topeDelMes()
  const semana = new Date(Date.now() - 7 * 864e5)
  const rechazadas = await db.select({ titulo: pautas.titulo, motivo: pautas.motivo }).from(pautas).where(and(inArray(pautas.estado, ['rechazada', 'con_problemas']), gte(pautas.creadoEn, semana))).limit(3)
  const activas = t.filas.filter((f) => f.estado === 'activa').length
  const enRevision = t.filas.filter((f) => f.estado === 'en_revision').length
  return { ...t, activas, enRevision, rechazadas, conectada: !!(await leerPublicidad()) }
}
