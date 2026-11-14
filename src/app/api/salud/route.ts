import { pool } from '@/lib/db'

// Lo usa Dokploy para saber si el contenedor está sano.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await pool.query('select 1')
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false, error: 'Sin conexión a la base de datos' }, { status: 503 })
  }
}
