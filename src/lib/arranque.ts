import 'server-only'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from '@/lib/db'
import { borrarAjuste, guardarAjusteSiFalta, leerAjuste } from '@/lib/ajustes'

// Lo que hace el servidor al arrancar, antes de atender a nadie.

/** Crea o actualiza las tablas. Así una versión nueva se instala sola al publicarla. */
export async function aplicarMigraciones() {
  const carpeta = process.env.MIGRACIONES_DIR || path.join(process.cwd(), 'drizzle')
  await migrate(db, { migrationsFolder: carpeta })
  console.log('[arranque] base de datos al día')
}

/**
 * Recuperar la contraseña: en Dokploy se pone REINICIAR_CLAVE=si y se vuelve a publicar.
 * La contraseña se borra y la pantalla de ingreso pide crear una nueva (con el código de instalación).
 */
export async function reiniciarClaveSiSePide() {
  if (process.env.REINICIAR_CLAVE?.toLowerCase() !== 'si') return
  await borrarAjuste('clave_hash')
  console.warn('[arranque] REINICIAR_CLAVE=si: se borró la contraseña. Entrá a crear una nueva y después sacá esa variable en Dokploy.')
}

/** El secreto que firma las sesiones: si no vino en el entorno, se genera una vez y queda en la base. */
export async function asegurarSecretoDeSesion() {
  if (process.env.SESION_SECRETO && process.env.SESION_SECRETO.length >= 32) return
  await guardarAjusteSiFalta('sesion_secreto', randomBytes(32).toString('hex'))
  process.env.SESION_SECRETO = (await leerAjuste('sesion_secreto'))!
}
