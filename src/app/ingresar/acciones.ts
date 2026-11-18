'use server'

import { timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { entorno } from '@/lib/entorno'
import { guardarAjusteSiFalta } from '@/lib/ajustes'
import { hashearClave, verificarClave } from '@/lib/auth/clave'
import { hashDeClave } from '@/lib/auth/clave-guardada'
import { ERROR_PIN, esPinValido } from '@/lib/auth/pin'
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
  // La IP real es la ÚLTIMA de X-Forwarded-For: la agrega nuestro propio proxy (Traefik en Dokploy).
  // Las anteriores las puede escribir cualquiera, y con eso saltearía el freno por IP.
  const cadena = (h.get('x-forwarded-for') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  return { ip: cadena.at(-1) || h.get('x-real-ip') || 'local', navegador: h.get('user-agent') }
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

const mensajeBloqueo = (min: number) => `Hubo demasiados intentos fallidos y el ingreso quedó frenado por seguridad. Probá de nuevo en ${min} ${min === 1 ? 'minuto' : 'minutos'}.`

export async function ingresar(_previo: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const { ip, navegador } = await quienEs()
  const bloqueo = await minutosDeBloqueo(ip)
  if (bloqueo > 0) return { error: mensajeBloqueo(bloqueo) }

  const guardado = await hashDeClave()
  if (!guardado) return { error: 'Todavía no se creó el PIN. Recargá la página.' }
  const clave = String(form.get('clave') ?? '')
  const ok = clave.length > 0 && (await verificarClave(clave, guardado))
  await registrarIntento(ip, ok, navegador)
  if (!ok) return { error: 'El PIN no es correcto.' }

  await abrirSesion()
  redirect(destinoSeguro(form.get('volver')))
}

function mismoTexto(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Primera vez: crear el PIN. Pide el código de instalación que Lucas puso en Dokploy. */
export async function crearClave(_previo: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const { ip, navegador } = await quienEs()
  const bloqueo = await minutosDeBloqueo(ip)
  if (bloqueo > 0) return { error: mensajeBloqueo(bloqueo) }
  if (await hashDeClave()) return { error: 'El PIN ya está creado. Recargá la página para ingresar.' }

  const esperado = entorno.codigoInstalacion
  if (!esperado) return { error: 'Falta el código de instalación (CODIGO_INSTALACION) en Dokploy.' }
  const codigo = String(form.get('codigo') ?? '').trim()
  if (!mismoTexto(codigo, esperado)) {
    await registrarIntento(ip, false, navegador)
    return { error: 'El código de instalación no es correcto.' }
  }
  const clave = String(form.get('clave') ?? '')
  if (!esPinValido(clave)) return { error: ERROR_PIN }
  if (clave !== String(form.get('repetir') ?? '')) return { error: 'Los dos PIN no coinciden.' }

  // Si dos personas crean a la vez, gana la primera: la otra recibe el aviso.
  if (!(await guardarAjusteSiFalta('clave_hash', await hashearClave(clave)))) {
    return { error: 'El PIN ya está creado. Recargá la página para ingresar.' }
  }
  await registrarIntento(ip, true, navegador)
  await abrirSesion()
  redirect('/')
}
