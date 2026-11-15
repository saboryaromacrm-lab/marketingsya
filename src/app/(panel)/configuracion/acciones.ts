'use server'

import { guardarAjuste } from '@/lib/ajustes'
import { hashearClave, verificarClave } from '@/lib/auth/clave'
import { hashDeClave, LARGO_MINIMO_CLAVE } from '@/lib/auth/clave-guardada'

export type EstadoCambioClave = { error?: string; ok?: boolean }

export async function cambiarClave(_previo: EstadoCambioClave, form: FormData): Promise<EstadoCambioClave> {
  const actual = String(form.get('actual') ?? '')
  const nueva = String(form.get('nueva') ?? '')
  const guardado = await hashDeClave()
  if (!guardado || !(await verificarClave(actual, guardado))) return { error: 'La contraseña actual no es correcta.' }
  if (nueva.length < LARGO_MINIMO_CLAVE) return { error: `La nueva tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.` }
  if (nueva !== String(form.get('repetir') ?? '')) return { error: 'Las dos contraseñas nuevas no coinciden.' }
  if (nueva === actual) return { error: 'La nueva es igual a la actual.' }
  await guardarAjuste('clave_hash', await hashearClave(nueva))
  return { ok: true }
}
