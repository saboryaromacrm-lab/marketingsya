'use server'

import { iniciarSincronizacion } from '@/lib/catalogo/iniciar'

export async function sincronizarAhora(): Promise<{ id: number } | { error: string }> {
  try {
    return { id: await iniciarSincronizacion() }
  } catch (e) {
    console.error('[sincronizar]', e)
    return { error: 'No se pudo iniciar la sincronización. Probá de nuevo.' }
  }
}
