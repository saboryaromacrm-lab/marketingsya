import { eq } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Estado de una sincronización, para la barra de avance (la pide cada segundo mientras corre).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return Response.json({ error: 'id inválido' }, { status: 400 })
  const [s] = await db
    .select({ id: esquema.sincronizaciones.id, estado: esquema.sincronizaciones.estado, etapa: esquema.sincronizaciones.etapa, avance: esquema.sincronizaciones.avance, resumen: esquema.sincronizaciones.resumen, error: esquema.sincronizaciones.error })
    .from(esquema.sincronizaciones)
    .where(eq(esquema.sincronizaciones.id, id))
  if (!s) return Response.json({ error: 'no existe' }, { status: 404 })
  return Response.json(s, { headers: { 'cache-control': 'no-store' } })
}
