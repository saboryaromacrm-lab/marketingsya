'use server'

import { revalidatePath } from 'next/cache'
import { leerConfig } from '@/lib/configuracion'
import { borrarConexion, cuotaInstagram, detectarCuentas, guardarConexion, guardarCuentas, leerCuentas, leerToken, type CuentasMeta } from '@/lib/meta/conexion'
import { ErrorMeta } from '@/lib/meta/errores'

type R<T> = ({ ok: true } & T) | { error: string }

const mensaje = (e: unknown) => (e instanceof ErrorMeta ? e.message : 'No se pudo hablar con Meta. Probá de nuevo en un rato.')

/** Prueba el token con Meta, detecta la página y el Instagram, y lo guarda cifrado. */
export async function guardarTokenMeta(token: string): Promise<R<{ cuentas: CuentasMeta }>> {
  const t = String(token ?? '').trim()
  if (t.length < 40 || /\s/.test(t)) return { error: 'Ese no parece un token de Meta: es una tira larga de letras y números, sin espacios (suele empezar con «EAA»).' }
  try {
    const config = await leerConfig()
    const anterior = await leerCuentas()
    const cuentas = await detectarCuentas(t, config.meta.versionApi, anterior?.paginaId)
    await guardarConexion(t, cuentas)
    revalidatePath('/', 'layout')
    return { ok: true, cuentas }
  } catch (e) {
    return { error: mensaje(e) }
  }
}

/** Si el token tiene varias páginas, Lucas elige con cuál publicar. */
export async function elegirPaginaMeta(paginaId: string): Promise<R<{ cuentas: CuentasMeta }>> {
  const cuentas = await leerCuentas()
  const p = cuentas?.paginas.find((x) => x.id === paginaId)
  if (!cuentas || !p) return { error: 'Esa página no está entre las del token.' }
  const nuevas = { ...cuentas, paginaId: p.id, paginaNombre: p.nombre, instagramId: p.instagramId, instagramUsuario: p.instagramUsuario }
  await guardarCuentas(nuevas)
  revalidatePath('/', 'layout')
  return { ok: true, cuentas: nuevas }
}

export type Prueba = { texto: string; ok: boolean }

/** Revisa todo: token, página, Instagram, permisos, cupo del día y que Meta pueda ver las imágenes. */
export async function probarConexionMeta(): Promise<R<{ cuentas: CuentasMeta | null; pruebas: Prueba[] }>> {
  const token = await leerToken()
  if (!token) return { error: 'Primero cargá el token.' }
  const config = await leerConfig()
  const pruebas: Prueba[] = []
  let cuentas: CuentasMeta | null = null
  try {
    cuentas = await detectarCuentas(token, config.meta.versionApi, (await leerCuentas())?.paginaId)
    await guardarCuentas(cuentas)
    pruebas.push({ ok: true, texto: `El token anda${cuentas.vence ? ` (vence el ${new Date(cuentas.vence).toLocaleDateString('es-AR')})` : ' y no vence'}.` })
    pruebas.push({ ok: true, texto: `Página de Facebook: ${cuentas.paginaNombre}.` })
    pruebas.push(cuentas.instagramId ? { ok: true, texto: `Instagram de empresa: @${cuentas.instagramUsuario ?? cuentas.instagramId}.` } : { ok: false, texto: 'La página no tiene un Instagram de empresa vinculado.' })
    if (cuentas.permisos) pruebas.push(cuentas.faltan.length ? { ok: false, texto: `Faltan permisos: ${cuentas.faltan.join(', ')}.` } : { ok: true, texto: 'Tiene todos los permisos para publicar.' })
    const cuota = await cuotaInstagram()
    if (cuota) pruebas.push({ ok: cuota.usadas < cuota.total, texto: `Hoy: ${cuota.usadas} de ${cuota.total} publicaciones permitidas en Instagram.` })
  } catch (e) {
    pruebas.push({ ok: false, texto: mensaje(e) })
  }
  // Meta descarga las imágenes desde la dirección pública: tiene que abrir desde afuera
  try {
    const r = await fetch(`${config.meta.urlPublica}/api/salud`, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    pruebas.push(r.ok ? { ok: true, texto: `La dirección pública (${config.meta.urlPublica}) responde: Meta va a poder bajar las imágenes.` } : { ok: false, texto: `La dirección pública respondió ${r.status}: revisala en «Avanzado».` })
  } catch {
    pruebas.push({ ok: false, texto: `No se pudo abrir ${config.meta.urlPublica}: revisá la dirección pública en «Avanzado».` })
  }
  revalidatePath('/', 'layout')
  return { ok: true, cuentas, pruebas }
}

export async function cuotaMeta() {
  return cuotaInstagram()
}

export async function borrarTokenMeta() {
  await borrarConexion()
  revalidatePath('/', 'layout')
}
