import 'server-only'
import { inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cola, COLA_PUBLICAR, COLA_RENDER, COLA_SINCRONIZAR } from '@/lib/cola'
import { ejecutarExportacion } from '@/lib/piezas/exportar'
import { ejecutarSincronizacion } from './sincronizar'
import { ejecutarPublicacion, recuperarAlArrancar, revisarVencidas } from '@/lib/publicaciones/motor'

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

  await recuperarAlArrancar()

  const boss = await cola()
  await boss.work<{ id: number }>(COLA_SINCRONIZAR, async ([trabajo]) => {
    await ejecutarSincronizacion(trabajo.data.id)
  })
  await boss.work<{ id: number }>(COLA_RENDER, async ([trabajo]) => {
    await ejecutarExportacion(trabajo.data.id)
  })
  await boss.work<{ id: number }>(COLA_PUBLICAR, async ([trabajo]) => {
    await ejecutarPublicacion(trabajo.data.id)
  })
  // Cada 20 segundos se fija si hay algo programado (o un reintento) que ya tiene que salir
  const revisar = () => revisarVencidas().catch((e) => console.error('[publicar] revisión', e))
  setInterval(revisar, 20_000).unref()
  void revisar()
  console.log('[cola] atendiendo la sincronización del catálogo, el armado de piezas y las publicaciones')
}
