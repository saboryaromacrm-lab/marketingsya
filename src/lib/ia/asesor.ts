import 'server-only'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { leerConfig } from '@/lib/configuracion'
import { DIAS, NOMBRE_DIA, TIPOS_IDEA, type Config, type TipoIdea } from '@/lib/configuracion-tipos'
import { datosIniciales, MAX, type DatosRecetas } from '@/lib/carruseles/tipos'
import { hoyFormosa, sumarDias } from '@/lib/promos/fechas'
import { ErrorIA, llamarClaude } from './claude'
import { candidatos, listaCandidatos, momento, sistemaMarca } from './contexto'

const { iaIdeas, iaChat, carruseles, promos, promoFilas, productos } = esquema

// ---------------------------------------------------------------------------
// Qué promocionar
// ---------------------------------------------------------------------------
export type Sugerencia = { id: number; motivo: string }
export type Sugerencias = { fecha: string; ideas: Sugerencia[] }

export async function generarSugerencias(): Promise<Sugerencias> {
  const c = await leerConfig()
  const cs = await candidatos(c, { limite: 220 })
  const validos = new Set(cs.map((x) => x.id))
  const { json } = await llamarClaude<{ ideas: Sugerencia[] }>({
    tipo: 'sugerencias',
    system: sistemaMarca(c),
    mensajes: [{ role: 'user', content: `${momento(c)}

Elegí ${c.ia.ideasPorVez} productos para promocionar esta semana, de la lista de abajo. Buscá variedad de categorías y que tengan sentido para la época, las fechas que se vienen y las novedades (nuevos, bajaron de precio). Evitá los que salieron hace poco en una pieza.
Para cada uno, un motivo corto y concreto para Lucas (máximo 14 palabras), por ejemplo: «Bajó 12 % · ideal para picadas de verano».

Productos (id | nombre | categoría | precio | señales):
${listaCandidatos(cs)}` }],
    esquema: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, motivo: { type: 'string' } }, required: ['id', 'motivo'], additionalProperties: false } } }, required: ['ideas'], additionalProperties: false },
  })
  const ideas = (json?.ideas ?? []).filter((x, i, a) => validos.has(x.id) && a.findIndex((y) => y.id === x.id) === i).slice(0, c.ia.ideasPorVez)
  if (!ideas.length) throw new ErrorIA('La IA no devolvió productos válidos. Probá de nuevo.')
  const datos: Sugerencias = { fecha: new Date().toISOString(), ideas }
  await guardarIdea('sugerencias', 'ultima', datos)
  return datos
}

// ---------------------------------------------------------------------------
// Calendario de la semana
// ---------------------------------------------------------------------------
export type Borrador = { tipo: 'carrusel' | 'promo'; id: number }
export type IdeaDia = { dia: string; tipo: TipoIdea; titulo: string; angulo: string; productos: number[]; borrador: Borrador | null }
export type Semana = { lunes: string; ideas: IdeaDia[]; fecha: string }

const PRODUCTOS_POR_TIPO: Record<TipoIdea, [number, number]> = { nutriofertas: [2, 4], receta: [3, 5], promo: [2, 6], lanzamiento: [4, 6], historia: [0, 2] }

/** Lunes de la semana de una fecha (AAAA-MM-DD). */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return sumarDias(fecha, -((d.getUTCDay() + 6) % 7))
}

export async function proponerSemana(lunes: string): Promise<Semana> {
  const c = await leerConfig()
  const dias = DIAS.map((d, i) => ({ dia: d, fecha: sumarDias(lunes, i), tipo: c.ia.calendario[d] })).filter((x) => x.tipo !== 'nada')
  if (!dias.length) throw new ErrorIA('No hay días con publicaciones en Configuración › Asesor IA › Calendario.')
  const cs = await candidatos(c, { limite: 200 })
  const validos = new Set(cs.map((x) => x.id))
  const plan = dias.map((x) => `- ${NOMBRE_DIA[x.dia]} ${x.fecha}: ${TIPOS_IDEA[x.tipo as TipoIdea]} (${PRODUCTOS_POR_TIPO[x.tipo as TipoIdea].join(' a ')} productos)`).join('\n')
  const { json } = await llamarClaude<{ ideas: { dia: string; titulo: string; angulo: string; productos: number[] }[] }>({
    tipo: 'semana',
    system: sistemaMarca(c),
    mensajes: [{ role: 'user', content: `${momento(c, 21)}

Armá el plan de contenido de la semana del ${lunes.slice(8, 10)}/${lunes.slice(5, 7)}. Una idea por cada día de esta lista, respetando el tipo:
${plan}

Para cada día: un título corto y atractivo para la pieza (máximo 6 palabras, sin el nombre de la marca), el ángulo en una oración (qué se comunica y por qué ahora) y los productos de la lista de abajo (por id). Que las ideas sean distintas entre sí, aprovechen la época, las fechas que se vienen y las novedades, y no repitan productos entre días.
En las recetas, elegí ingredientes que combinen de verdad en una receta saludable y fácil.

Productos (id | nombre | categoría | precio | señales):
${listaCandidatos(cs)}` }],
    esquema: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { dia: { type: 'string', enum: dias.map((x) => x.fecha) }, titulo: { type: 'string' }, angulo: { type: 'string' }, productos: { type: 'array', items: { type: 'integer' } } }, required: ['dia', 'titulo', 'angulo', 'productos'], additionalProperties: false } } }, required: ['ideas'], additionalProperties: false },
  })
  const ideas: IdeaDia[] = dias.map((x) => {
    const r = json?.ideas.find((y) => y.dia === x.fecha)
    const [, max] = PRODUCTOS_POR_TIPO[x.tipo as TipoIdea]
    return { dia: x.fecha, tipo: x.tipo as TipoIdea, titulo: (r?.titulo ?? TIPOS_IDEA[x.tipo as TipoIdea]).slice(0, 80), angulo: (r?.angulo ?? '').slice(0, 300), productos: [...new Set((r?.productos ?? []).filter((id) => validos.has(id)))].slice(0, max), borrador: null }
  })
  const semana: Semana = { lunes, ideas, fecha: new Date().toISOString() }
  await guardarIdea('semana', lunes, semana)
  return semana
}

export async function leerSemana(lunes: string): Promise<Semana | null> {
  const [f] = await db.select({ datos: iaIdeas.datos }).from(iaIdeas).where(and(eq(iaIdeas.tipo, 'semana'), eq(iaIdeas.clave, lunes)))
  return (f?.datos as Semana | undefined) ?? null
}
export async function leerSugerencias(): Promise<Sugerencias | null> {
  const [f] = await db.select({ datos: iaIdeas.datos }).from(iaIdeas).where(and(eq(iaIdeas.tipo, 'sugerencias'), eq(iaIdeas.clave, 'ultima')))
  return (f?.datos as Sugerencias | undefined) ?? null
}
async function guardarIdea(tipo: 'sugerencias' | 'semana', clave: string, datos: object) {
  await db.insert(iaIdeas).values({ tipo, clave, datos: datos as Record<string, unknown> }).onConflictDoUpdate({ target: [iaIdeas.tipo, iaIdeas.clave], set: { datos: datos as Record<string, unknown>, creadoEn: new Date() } })
}

/** Crea el borrador (carrusel o promo) de una idea del calendario y lo deja anotado en la idea. */
export async function armarBorrador(lunes: string, indice: number): Promise<Borrador> {
  const semana = await leerSemana(lunes)
  const idea = semana?.ideas[indice]
  if (!semana || !idea) throw new ErrorIA('Esa idea ya no existe. Volvé a proponer la semana.')
  if (idea.borrador) return idea.borrador
  const c = await leerConfig()
  let borrador: Borrador
  if (idea.tipo === 'receta') {
    borrador = { tipo: 'carrusel', id: await generarReceta({ restriccion: '', idea: `${idea.titulo}. ${idea.angulo}`, productos: idea.productos }) }
  } else if (idea.tipo === 'promo') {
    borrador = { tipo: 'promo', id: await crearPromo(c, idea) }
  } else if (idea.tipo === 'nutriofertas' || idea.tipo === 'lanzamiento') {
    const datos = datosIniciales(idea.tipo, idea.productos)
    const [{ id }] = await db.insert(carruseles).values({ estilo: idea.tipo, titulo: idea.titulo.slice(0, 80), listaId: c.piezas.listaId, datos: datos as unknown as Record<string, unknown> }).returning({ id: carruseles.id })
    borrador = { tipo: 'carrusel', id }
  } else {
    throw new ErrorIA('Las ideas para historia no tienen borrador: son para que las grabes o subas vos.')
  }
  semana.ideas[indice] = { ...idea, borrador }
  await guardarIdea('semana', lunes, semana)
  return borrador
}

async function crearPromo(c: Config, idea: IdeaDia): Promise<number> {
  const desde = idea.dia < hoyFormosa() ? hoyFormosa() : idea.dia
  const titulo = idea.titulo.toUpperCase().slice(0, 24)
  const [{ id }] = await db.insert(promos).values({ titulo, desde, hasta: sumarDias(desde, c.piezas.vigenciaDias), listaId: c.piezas.listaId, formatos: c.piezas.formatos }).returning({ id: promos.id })
  if (idea.productos.length) await db.insert(promoFilas).values(idea.productos.map((pid, orden) => ({ promoId: id, orden, tipo: 'producto' as const, descuento: c.piezas.descuento, productos: [{ id: pid }] })))
  return id
}

// ---------------------------------------------------------------------------
// Recetas
// ---------------------------------------------------------------------------
type RecetaIA = { titulo: string; bajada: string; ingredientes: { id: number; cantidad: string; texto: string }[]; pasos: string[]; porQue: { id: number; nombre: string; texto: string }[] }

/** La IA arma una receta con productos del catálogo (con foto) y se crea el carrusel Recetas ya lleno. Devuelve su id. */
export async function generarReceta(p: { restriccion: string; idea: string; productos?: number[] }): Promise<number> {
  const c = await leerConfig()
  const cs = await candidatos(c, { limite: 600, paraRecetas: true, prioridad: p.productos })
  const validos = new Set(cs.map((x) => x.id))
  const catalogo = `Productos del catálogo para recetas (id | nombre | categoría):\n${listaCandidatos(cs.map((x) => ({ ...x, senales: [] })), false)}`
  const pedido = [
    p.restriccion ? `Restricción: ${p.restriccion}.` : '',
    p.idea ? `Idea de Lucas: ${p.idea}.` : 'Elegí vos una receta que tenga sentido para la época.',
    p.productos?.length ? `Usá estos productos si combinan: ${p.productos.join(', ')}.` : '',
  ].filter(Boolean).join(' ')
  const { json } = await llamarClaude<RecetaIA>({
    tipo: 'receta',
    system: [sistemaMarca(c), catalogo],
    mensajes: [{ role: 'user', content: `${momento(c)}

Proponé una receta saludable, rica y fácil para un carrusel de Instagram. ${pedido}
- Título de la receta: 2 o 3 palabras por renglón, separando los renglones con « / » (ejemplo: «Desayuno / saludable»), máximo 2 renglones.
- Bajada: porciones y nombre corto (ejemplo: «Para 1 bowl · avena nocturna»), máximo 40 letras.
- Ingredientes: de 3 a ${MAX.ingredientes}, solo productos de la lista (por id), con la cantidad corta («½ taza», «1 cucharada», «Un puñado») y el texto del ingrediente empezando con «de» en minúscula («de avena instantánea»), máximo 40 letras.
- Pasos: de 2 a ${MAX.pasos}, cortos y claros, en voseo, máximo 110 letras cada uno.
- Por qué te hace bien: hasta ${MAX.porQue} ingredientes de los que usaste, con un nombre corto (1 o 2 palabras) y un beneficio general sin promesas (máximo 60 letras).` }],
    esquema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' }, bajada: { type: 'string' },
        ingredientes: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, cantidad: { type: 'string' }, texto: { type: 'string' } }, required: ['id', 'cantidad', 'texto'], additionalProperties: false } },
        pasos: { type: 'array', items: { type: 'string' } },
        porQue: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, nombre: { type: 'string' }, texto: { type: 'string' } }, required: ['id', 'nombre', 'texto'], additionalProperties: false } },
      },
      required: ['titulo', 'bajada', 'ingredientes', 'pasos', 'porQue'],
      additionalProperties: false,
    },
  })
  if (!json) throw new ErrorIA('La IA no devolvió la receta. Probá de nuevo.')
  const ingredientes = json.ingredientes.filter((x) => validos.has(x.id)).slice(0, MAX.ingredientes)
  if (!ingredientes.length) throw new ErrorIA('La receta no usó productos del catálogo. Probá con otra idea.')
  const d = datosIniciales('recetas', ingredientes.map((x) => x.id)) as DatosRecetas
  d.portada.titulo = json.titulo.slice(0, 60) || d.portada.titulo
  d.ingredientes.bajada = json.bajada.slice(0, 40)
  d.ingredientes.items = ingredientes.map((x) => ({ id: x.id, cantidad: x.cantidad.slice(0, 24), texto: x.texto.slice(0, 50) || null }))
  const pasos = json.pasos.map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, MAX.pasos)
  d.preparacion.pasos = pasos.length >= MAX.pasosMin ? pasos : [...pasos, '', ''].slice(0, MAX.pasosMin)
  const usados = new Set(ingredientes.map((x) => x.id))
  const porQue = json.porQue.filter((x) => usados.has(x.id)).slice(0, MAX.porQue)
  if (porQue.length) d.porQue.items = porQue.map((x) => ({ id: x.id, nombre: x.nombre.slice(0, 30) || null, texto: x.texto.slice(0, 160) || null }))
  const titulo = d.portada.titulo.replace(/\s*\/\s*/g, ' ')
  const [{ id }] = await db.insert(carruseles).values({ estilo: 'recetas', titulo: `Receta: ${titulo}`.slice(0, 80), listaId: c.piezas.listaId, datos: d as unknown as Record<string, unknown> }).returning({ id: carruseles.id })
  return id
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export async function historialChat() {
  return db.select().from(iaChat).orderBy(asc(iaChat.id)).limit(200)
}

export async function enviarChat(texto: string): Promise<string> {
  const c = await leerConfig()
  const anteriores = (await db.select().from(iaChat).orderBy(desc(iaChat.id)).limit(30)).reverse()
  const cs = await candidatos(c, { limite: 120 })
  const contexto = `${momento(c)}\nAlgunos productos del catálogo de hoy (id | nombre | categoría | precio | señales), por si sirven para responder:\n${listaCandidatos(cs)}`
  const { texto: respuesta } = await llamarClaude({
    tipo: 'chat',
    system: [sistemaMarca(c), `Respondé como en una charla: claro, concreto y breve (máximo 200 palabras salvo que te pidan algo largo). Si proponés productos, nombralos por su nombre (sin el id).\n\n${contexto}`],
    mensajes: [...anteriores.map((m) => ({ role: m.rol, content: m.texto })), { role: 'user', content: texto }],
    maxTokens: 8000,
  })
  await db.insert(iaChat).values([{ rol: 'user', texto }, { rol: 'assistant', texto: respuesta }])
  return respuesta
}

export async function borrarChat() {
  await db.delete(iaChat)
}

// ---------------------------------------------------------------------------
// Textos: posteo, frases y títulos
// ---------------------------------------------------------------------------
export async function mejorarTexto(p: { pieza: string; productos: number[]; actual: string }): Promise<string> {
  const c = await leerConfig()
  const nombres = p.productos.length ? (await db.select({ id: productos.id, nombre: productos.nombreSugerido }).from(productos).where(inArray(productos.id, p.productos.slice(0, 20)))).map((x) => x.nombre) : []
  const { texto } = await llamarClaude({
    tipo: 'texto',
    system: sistemaMarca(c),
    mensajes: [{ role: 'user', content: `Escribí el texto del posteo de Instagram para esta pieza: ${p.pieza}.${nombres.length ? ` Productos: ${nombres.join(', ')}.` : ''}
Texto actual (mejoralo, no lo copies): «${p.actual.slice(0, 1500)}»
Que tenga: un gancho en la primera línea, 2 o 3 renglones cortos, la tienda (${c.contacto.web}, sin mínimo de compra), el WhatsApp (${c.contacto.whatsapp}) y al final los hashtags fijos más 1 o 2 del tema. Máximo 600 letras.
Respondé solo con el texto del posteo, sin comillas ni explicaciones.`.slice(0, 4000) }],
    maxTokens: 4000,
  })
  return texto.slice(0, 2200)
}

export async function sugerirCampo(p: { campo: 'frase' | 'titulo'; contexto: string; actual: string }): Promise<string> {
  const c = await leerConfig()
  const pedido = p.campo === 'frase'
    ? 'Escribí una frase corta para acompañar este producto en una placa (máximo 60 letras, sin el nombre del producto, sin promesas medicinales).'
    : 'Escribí un título corto para esta placa (máximo 4 palabras; si conviene en 2 renglones, separalos con « / »).'
  const { texto } = await llamarClaude({
    tipo: 'texto',
    system: sistemaMarca(c),
    mensajes: [{ role: 'user', content: `${pedido}\nPieza: ${p.contexto.slice(0, 500)}\nTexto actual: «${p.actual.slice(0, 200)}»\nRespondé solo con el texto, sin comillas.` }],
    maxTokens: 2000,
  })
  return texto.replace(/^[«"']|[»"']$/g, '').slice(0, p.campo === 'frase' ? 160 : 60)
}
