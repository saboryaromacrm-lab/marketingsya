import 'server-only'
import { guardarAjuste, leerAjuste } from '@/lib/ajustes'
import { CONFIG_INICIAL, limpiarConfig, type Config } from './configuracion-tipos'

/** La configuración guardada, mezclada con los valores de entrada (siempre completa y válida). */
export async function leerConfig(): Promise<Config> {
  const guardada = await leerAjuste('configuracion')
  if (!guardada) return CONFIG_INICIAL
  try {
    return limpiarConfig(JSON.parse(guardada))
  } catch {
    return CONFIG_INICIAL
  }
}

/** Guarda una sección (contacto, piezas o ia) sin tocar las demás. */
export async function guardarSeccion<K extends keyof Config>(seccion: K, valores: Partial<Config[K]>): Promise<Config> {
  const actual = await leerConfig()
  const nueva = limpiarConfig({ ...actual, [seccion]: { ...actual[seccion], ...valores } })
  await guardarAjuste('configuracion', JSON.stringify(nueva))
  return nueva
}
