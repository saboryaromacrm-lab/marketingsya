import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { entorno } from '@/lib/entorno'
import * as esquema from './esquema'

// Una sola conexión compartida. En desarrollo, Next recarga los módulos a cada
// cambio: guardarla en globalThis evita abrir conexiones nuevas cada vez.
// Máximo 5 conexiones: el servidor se comparte con el ERP.
const global = globalThis as unknown as { pool?: Pool }

export const pool = (global.pool ??= new Pool({ connectionString: entorno.databaseUrl, max: 5 }))

export const db = drizzle(pool, { schema: esquema })
export { esquema }
