import 'server-only'
import { leerAjuste } from '@/lib/ajustes'
import { entorno } from '@/lib/entorno'

/** Hash de la contraseña: la creada desde la plataforma; en desarrollo, la del entorno. */
export async function hashDeClave(): Promise<string | null> {
  return (await leerAjuste('clave_hash')) ?? entorno.claveHashEntorno
}

export const LARGO_MINIMO_CLAVE = 10
