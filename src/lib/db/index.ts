import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as esquema from './esquema'

// Una sola conexión compartida. En desarrollo, Next recarga los módulos a cada
// cambio: guardarla en globalThis evita abrir conexiones nuevas cada vez.
// Máximo 5 conexiones: el servidor se comparte con el ERP.
// La conexión se abre recién con la primera consulta: así se puede compilar (en Docker) sin base de datos.
const global = globalThis as unknown as { pool?: Pool }

export const pool = (global.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }))

export const db = drizzle(pool, { schema: esquema })
export { esquema }
