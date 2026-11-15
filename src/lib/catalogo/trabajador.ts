import 'server-only'
import { inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cola, COLA_RENDER, COLA_SINCRONIZAR } from '@/lib/cola'
import { ejecutarExportacion } from '@/lib/piezas/exportar'
import { ejecutarSincronizacion } from './sincronizar'

// Arranca con el servidor (ver src/instrumentation.ts) y atiende la cola de sincronización.
export async function arrancarTrabajador() {
  // Si el servidor se reinició en medio de una sincronización, esa quedó colgada:
  // se marca con error para que el botón vuelva a funcionar.
  await db
    .update(esquema.sincronizaciones)
    .set({ estado: 'error', error: 'Se interrumpió porque se reinició el servidor. Volvé a sincronizar.', etapa: null, terminadaEn: new Date() })
    .where(inArray(esquema.sincronizaciones.estado, ['en_cola', 'corriendo']))
  await db
    .update(esquema.exportaciones)
    .set({ estado: 'error', error: 'Se interrumpió porque se reinició el servidor. Volvé a exportar.', terminadoEn: new Date() })
    .where(inArray(esquema.exportaciones.estado, ['en_cola', 'corriendo']))

  const boss = await cola()
  await boss.work<{ id: number }>(COLA_SINCRONIZAR, async ([trabajo]) => {
    await ejecutarSincronizacion(trabajo.data.id)
  })
  await boss.work<{ id: number }>(COLA_RENDER, async ([trabajo]) => {
    await ejecutarExportacion(trabajo.data.id)
  })
  console.log('[cola] atendiendo la sincronización del catálogo y el armado de piezas')
}
