import 'server-only'
import { PgBoss } from 'pg-boss'
import { entorno } from '@/lib/entorno'

// Cola de tareas guardada en el mismo PostgreSQL (esquema «pgboss»).
// Sirve para lo que tarda: sincronizar, renderizar piezas, publicar.

export const COLA_SINCRONIZAR = 'sincronizar-catalogo'
export const COLA_RENDER = 'renderizar-piezas'
export const COLA_PUBLICAR = 'publicar-meta'

const global = globalThis as unknown as { cola?: Promise<PgBoss> }

async function crear(): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: entorno.databaseUrl, max: 2, schema: 'pgboss', application_name: 'marketing-cola' })
  boss.on('error', (e) => console.error('[cola]', e))
  await boss.start()
  // Sin reintentos automáticos: si falla, Lucas ve el error y vuelve a apretar el botón.
  // 20 minutos de margen: la primera vez copia más de 2.000 fotos.
  if (!(await boss.getQueue(COLA_SINCRONIZAR))) {
    await boss.createQueue(COLA_SINCRONIZAR, { retryLimit: 0, expireInSeconds: 20 * 60 })
  }
  if (!(await boss.getQueue(COLA_RENDER))) {
    await boss.createQueue(COLA_RENDER, { retryLimit: 0, expireInSeconds: 10 * 60 })
  }
  // Los reintentos de las publicaciones los maneja la plataforma (por destino), no la cola
  if (!(await boss.getQueue(COLA_PUBLICAR))) {
    await boss.createQueue(COLA_PUBLICAR, { retryLimit: 0, expireInSeconds: 10 * 60 })
  }
  return boss
}

export function cola(): Promise<PgBoss> {
  return (global.cola ??= crear().catch((e) => {
    global.cola = undefined
    throw e
  }))
}
