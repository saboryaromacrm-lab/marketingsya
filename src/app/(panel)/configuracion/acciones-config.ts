'use server'

import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { borrarAjuste, guardarAjuste } from '@/lib/ajustes'
import { guardarSeccion } from '@/lib/configuracion'
import type { Config } from '@/lib/configuracion-tipos'
import { cifrar } from '@/lib/ia/cifrado'
import { clienteIA } from '@/lib/ia/claude'

type Seccion = 'contacto' | 'piezas' | 'ia'

/** Guarda una sección de Configuración (todo se valida y se corrige en limpiarConfig). */
export async function guardarConfig<K extends Seccion>(seccion: K, valores: Partial<Config[K]>): Promise<{ ok: true; config: Config } | { error: string }> {
  if (!['contacto', 'piezas', 'ia'].includes(seccion)) return { error: 'Sección desconocida.' }
  const config = await guardarSeccion(seccion, valores)
  revalidatePath('/', 'layout')
  return { ok: true, config }
}

/** Prueba la clave con Anthropic (sin costo: solo pide los datos del modelo) y la guarda cifrada. */
export async function guardarClaveIA(clave: string, modelo: string): Promise<{ ok: true; fin: string } | { error: string }> {
  const c = String(clave ?? '').trim()
  if (!/^sk-ant-[\w-]{10,}$/.test(c)) return { error: 'Esa no parece una clave de Anthropic: empieza con «sk-ant-».' }
  try {
    await clienteIA(c).models.retrieve(modelo)
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'Anthropic dice que la clave no es válida.' }
    if (e instanceof Anthropic.NotFoundError) return { error: 'La clave anda, pero no tiene acceso a ese modelo.' }
    if (e instanceof Anthropic.APIConnectionError) return { error: 'No se pudo conectar con Anthropic para probar la clave.' }
    return { error: 'No se pudo probar la clave con Anthropic.' }
  }
  await guardarAjuste('ia_clave', cifrar(c))
  revalidatePath('/', 'layout')
  return { ok: true, fin: c.slice(-4) }
}

export async function borrarClaveIA() {
  await borrarAjuste('ia_clave')
  revalidatePath('/', 'layout')
}
