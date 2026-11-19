'use server'

import { revalidatePath } from 'next/cache'
import { ErrorIA, estadoIA, type EstadoIA } from '@/lib/ia/claude'
import * as asesor from '@/lib/ia/asesor'
import { esFecha } from '@/lib/promos/fechas'

type R<T> = ({ ok: true; estado: EstadoIA } & T) | { error: string }

// Cada acción devuelve también el estado del gasto, así el contador se actualiza al momento
async function correr<T extends object>(fn: () => Promise<T>): Promise<R<T>> {
  try {
    const r = await fn()
    return { ok: true, ...r, estado: await estadoIA() }
  } catch (e) {
    if (e instanceof ErrorIA) return { error: e.message }
    console.error('[asesor]', e)
    return { error: 'Algo falló al hablar con la IA. Probá de nuevo en un rato.' }
  }
}

export async function accionSugerencias() {
  return correr(async () => ({ sugerencias: await asesor.generarSugerencias() }))
}

export async function accionSemana(lunes: string) {
  return correr(async () => {
    if (!esFecha(lunes)) throw new ErrorIA('Fecha inválida.')
    return { semana: await asesor.proponerSemana(asesor.lunesDe(lunes)) }
  })
}

export async function accionBorrador(lunes: string, indice: number) {
  return correr(async () => {
    if (!esFecha(lunes) || !Number.isInteger(indice)) throw new ErrorIA('Idea inválida.')
    const b = await asesor.armarBorrador(lunes, indice)
    revalidatePath('/carruseles')
    revalidatePath('/promos')
    return { borrador: b }
  })
}

export async function accionReceta(restriccion: string, idea: string) {
  return correr(async () => {
    const id = await asesor.generarReceta({ restriccion: String(restriccion ?? '').slice(0, 80), idea: String(idea ?? '').slice(0, 300) })
    revalidatePath('/carruseles')
    return { id }
  })
}

export async function accionChat(texto: string) {
  return correr(async () => {
    const t = String(texto ?? '').trim().slice(0, 2000)
    if (!t) throw new ErrorIA('Escribí una pregunta.')
    return { respuesta: await asesor.enviarChat(t) }
  })
}

export async function accionBorrarChat() {
  await asesor.borrarChat()
  revalidatePath('/asesor')
}

export async function accionMejorarTexto(pieza: string, productos: number[], actual: string) {
  return correr(async () => ({ texto: await asesor.mejorarTexto({ pieza: String(pieza).slice(0, 300), productos: (Array.isArray(productos) ? productos : []).filter(Number.isInteger), actual: String(actual ?? '') }) }))
}

export async function accionSugerirCampo(campo: 'frase' | 'titulo', contexto: string, actual: string) {
  return correr(async () => ({ texto: await asesor.sugerirCampo({ campo: campo === 'titulo' ? 'titulo' : 'frase', contexto: String(contexto ?? ''), actual: String(actual ?? '') }) }))
}
