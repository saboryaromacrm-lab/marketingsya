// Aplica las migraciones pendientes de la carpeta drizzle/.
// Se corre solo al arrancar el contenedor, antes de levantar la app.
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL')
  process.exit(1)
}
const pool = new Pool({ connectionString: url, max: 1 })
await migrate(drizzle(pool), { migrationsFolder: 'drizzle' })
await pool.end()
console.log('Migraciones al día.')
