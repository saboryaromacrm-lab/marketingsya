import 'server-only'
import { inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { cola, COLA_PUBLICAR, COLA_RENDER, COLA_SINCRONIZAR } from '@/lib/cola'
import { ejecutarExportacion } from '@/lib/piezas/exportar'
import { ejecutarSincronizacion } from './sincronizar'
import { ejecutarPublicacion, recuperarAlArrancar, revisarVencidas } from '@/lib/publicaciones/motor'
import { sincronizarPautas } from '@/lib/pautas/motor'
import { limpiarBiblioteca, procesarVideo, recuperarVideos } from '@/lib/video/propios/biblioteca'

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
  // Una sola cola para todo lo pesado (de a uno por vez): armar piezas y videos, y comprimir los videos que sube Lucas
  await boss.work<{ id?: number; video?: number }>(COLA_RENDER, async ([trabajo]) => {
    if (trabajo.data.video) await procesarVideo(trabajo.data.video)
    else if (trabajo.data.id) await ejecutarExportacion(trabajo.data.id)
  })
  await recuperarVideos().catch((e) => console.error('[videos] recuperar', e))
  await boss.work<{ id: number }>(COLA_PUBLICAR, async ([trabajo]) => {
    await ejecutarPublicacion(trabajo.data.id)
  })
  // Cada 20 segundos se fija si hay algo programado (o un reintento) que ya tiene que salir
  const revisar = () => revisarVencidas().catch((e) => console.error('[publicar] revisión', e))
  setInterval(revisar, 20_000).unref()
  void revisar()
  // Cada 15 minutos se piden a Meta el estado y los resultados de las pautas vivas (así Inicio avisa los rechazos)
  setInterval(() => void sincronizarPautas(false).catch((e) => console.error('[pautas] sincronización', e)), 15 * 60_000).unref()
  // Cada hora: se borran los videos sin usar de más de 90 días (y las subidas que quedaron a medias)
  setInterval(() => void limpiarBiblioteca().catch((e) => console.error('[videos] limpieza', e)), 60 * 60_000).unref()
  void limpiarBiblioteca().catch((e) => console.error('[videos] limpieza', e))
  console.log('[cola] atendiendo la sincronización del catálogo, el armado de piezas, las publicaciones y las pautas')
}
