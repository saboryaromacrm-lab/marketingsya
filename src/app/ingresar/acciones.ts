'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { entorno } from '@/lib/entorno'
import { verificarClave } from '@/lib/auth/clave'
import { COOKIE_SESION, crearToken } from '@/lib/auth/sesion'
import { minutosDeBloqueo, registrarIntento } from '@/lib/auth/limite'

export type EstadoIngreso = { error?: string }

// Solo se vuelve a rutas internas: evita que un enlace armado
// mande a Lucas a otro sitio después de ingresar.
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const v = typeof valor === 'string' ? valor : ''
  return v.startsWith('/') && !v.startsWith('//') ? v : '/'
}

export async function ingresar(_previo: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local'
  const navegador = h.get('user-agent')

  const bloqueo = await minutosDeBloqueo(ip)
  if (bloqueo > 0) {
    return { error: `Demasiados intentos fallidos. Probá de nuevo en ${bloqueo} ${bloqueo === 1 ? 'minuto' : 'minutos'}.` }
  }

  const clave = String(form.get('clave') ?? '')
  const ok = clave.length > 0 && (await verificarClave(clave, entorno.claveHash))
  await registrarIntento(ip, ok, navegador)
  if (!ok) return { error: 'La contraseña no es correcta.' }

  const { token, vence } = crearToken(entorno.sesionSecreto, entorno.sesionDias)
  ;(await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: vence,
  })
  redirect(destinoSeguro(form.get('volver')))
}
