import 'server-only'
import { leerAjuste } from '@/lib/ajustes'
import { entorno } from '@/lib/entorno'

/** Hash del PIN: el creado desde la plataforma; en desarrollo, el del entorno. */
export async function hashDeClave(): Promise<string | null> {
  return (await leerAjuste('clave_hash')) ?? entorno.claveHashEntorno
}

