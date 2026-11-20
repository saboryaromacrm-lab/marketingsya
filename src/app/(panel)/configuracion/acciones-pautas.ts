'use server'

import { revalidatePath } from 'next/cache'
import { limpiarPublico } from '@/lib/configuracion-tipos'
import { detectarYGuardar } from '@/lib/pautas/motor'
import { clienteMeta } from '@/lib/meta/conexion'
import { buscarIntereses, buscarRegion } from '@/lib/meta/anuncios'
import { ErrorMeta } from '@/lib/meta/errores'

/** Busca la cuenta publicitaria con el token de Meta (o cambia a otra, si el token ve varias). */
export async function detectarCuentaPublicitaria(preferida?: string) {
  const r = await detectarYGuardar(preferida ?? null)
  revalidatePath('/', 'layout')
  return r
}

/** Prueba un público contra Meta: que exista la zona y qué intereses encuentra. No crea nada ni gasta. */
export async function probarPublico(valor: unknown): Promise<{ ok: true; zona: string; encontrados: string[]; faltan: string[] } | { error: string }> {
  const p = limpiarPublico(valor)
  if (!p) return { error: 'Completá el nombre y la zona del público.' }
  try {
    const { g } = await clienteMeta()
    let zona = p.zona.tipo === 'radio' ? `${p.zona.nombre}, ${p.zona.km} km alrededor` : ''
    if (p.zona.tipo === 'region') {
      const r = await buscarRegion(g, p.zona.nombre)
      if (!r) return { error: `Meta no encontró la provincia «${p.zona.nombre}».` }
      zona = r.name
    }
    const encontrados = await buscarIntereses(g, p.intereses)
    const faltan = p.intereses.filter((i) => !encontrados.some((e) => e.name.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(e.name.toLowerCase())))
    return { ok: true, zona, encontrados: encontrados.map((e) => e.name), faltan }
  } catch (e) {
    return { error: e instanceof ErrorMeta ? e.message : 'No se pudo hablar con Meta.' }
  }
}
