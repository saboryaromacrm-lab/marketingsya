'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { entorno } from '@/lib/entorno'
import { guardarAjusteSiFalta } from '@/lib/ajustes'
import { hashearClave, verificarClave } from '@/lib/auth/clave'
import { hashDeClave, LARGO_MINIMO_CLAVE } from '@/lib/auth/clave-guardada'
import { COOKIE_SESION, crearToken } from '@/lib/auth/sesion'
import { minutosDeBloqueo, registrarIntento } from '@/lib/auth/limite'
import { asegurarSecretoDeSesion } from '@/lib/arranque'

export type EstadoIngreso = { error?: string }

// Solo se vuelve a rutas internas: evita que un enlace armado
// mande a Lucas a otro sitio después de ingresar.
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const v = typeof valor === 'string' ? valor : ''
  return v.startsWith('/') && !v.startsWith('//') ? v : '/'
}

async function quienEs() {
  const h = await headers()
  return { ip: h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local', navegador: h.get('user-agent') }
}

async function abrirSesion() {
  // Por si alguien entra en el primer segundo, antes de que termine el arranque
  await asegurarSecretoDeSesion()
  const { token, vence } = crearToken(entorno.sesionSecreto, entorno.sesionDias)
  ;(await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: vence,
  })
}

const mensajeBloqueo = (min: number) => `Demasiados intentos fallidos. Probá de nuevo en ${min} ${min === 1 ? 'minuto' : 'minutos'}.`

export async function ingresar(_previo: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const { ip, navegador } = await quienEs()
  const bloqueo = await minutosDeBloqueo(ip)
  if (bloqueo > 0) return { error: mensajeBloqueo(bloqueo) }

  const guardado = await hashDeClave()
  if (!guardado) return { error: 'Todavía no se creó la contraseña. Recargá la página.' }
  const clave = String(form.get('clave') ?? '')
  const ok = clave.length > 0 && (await verificarClave(clave, guardado))
  await registrarIntento(ip, ok, navegador)
  if (!ok) return { error: 'La contraseña no es correcta.' }

  await abrirSesion()
  redirect(destinoSeguro(form.get('volver')))
}

function mismoTexto(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Primera vez: crear la contraseña. Pide el código de instalación que Lucas puso en Dokploy. */
export async function crearClave(_previo: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const { ip, navegador } = await quienEs()
  const bloqueo = await minutosDeBloqueo(ip)
  if (bloqueo > 0) return { error: mensajeBloqueo(bloqueo) }
  if (await hashDeClave()) return { error: 'La contraseña ya está creada. Recargá la página para ingresar.' }

  const esperado = entorno.codigoInstalacion
  if (!esperado) return { error: 'Falta el código de instalación (CODIGO_INSTALACION) en Dokploy.' }
  const codigo = String(form.get('codigo') ?? '').trim()
  if (!mismoTexto(codigo, esperado)) {
    await registrarIntento(ip, false, navegador)
    return { error: 'El código de instalación no es correcto.' }
  }
  const clave = String(form.get('clave') ?? '')
  if (clave.length < LARGO_MINIMO_CLAVE) return { error: `La contraseña tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.` }
  if (clave !== String(form.get('repetir') ?? '')) return { error: 'Las dos contraseñas no coinciden.' }

  // Si dos personas crean a la vez, gana la primera: la otra recibe el aviso.
  if (!(await guardarAjusteSiFalta('clave_hash', await hashearClave(clave)))) {
    return { error: 'La contraseña ya está creada. Recargá la página para ingresar.' }
  }
  await registrarIntento(ip, true, navegador)
  await abrirSesion()
  redirect('/')
}
