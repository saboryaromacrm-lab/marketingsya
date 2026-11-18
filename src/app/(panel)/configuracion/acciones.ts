'use server'

import { guardarAjuste } from '@/lib/ajustes'
import { hashearClave, verificarClave } from '@/lib/auth/clave'
import { hashDeClave } from '@/lib/auth/clave-guardada'
import { ERROR_PIN, esPinValido } from '@/lib/auth/pin'

export type EstadoCambioClave = { error?: string; ok?: boolean }

export async function cambiarClave(_previo: EstadoCambioClave, form: FormData): Promise<EstadoCambioClave> {
  const actual = String(form.get('actual') ?? '')
  const nueva = String(form.get('nueva') ?? '')
  const guardado = await hashDeClave()
  if (!guardado || !(await verificarClave(actual, guardado))) return { error: 'El PIN actual no es correcto.' }
  if (!esPinValido(nueva)) return { error: ERROR_PIN }
  if (nueva !== String(form.get('repetir') ?? '')) return { error: 'Los dos PIN nuevos no coinciden.' }
  if (nueva === actual) return { error: 'El PIN nuevo es igual al actual.' }
  await guardarAjuste('clave_hash', await hashearClave(nueva))
  return { ok: true }
}
