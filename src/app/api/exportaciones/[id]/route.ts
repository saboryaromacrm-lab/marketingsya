import { eq } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { urlMedia } from '@/lib/media'

export const dynamic = 'force-dynamic'

// Estado de una exportación, para la barra de avance (se pide cada segundo mientras corre).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return Response.json({ error: 'id inválido' }, { status: 400 })
  const [x] = await db.select().from(esquema.exportaciones).where(eq(esquema.exportaciones.id, id))
  if (!x) return Response.json({ error: 'no existe' }, { status: 404 })
  const segundos = x.terminadoEn ? Math.round((x.terminadoEn.getTime() - x.creadoEn.getTime()) / 1000) : null
  return Response.json(
    { id: x.id, estado: x.estado, avance: x.avance, error: x.error, segundos, archivos: x.archivos.map(urlMedia), zip: x.zip ? urlMedia(x.zip) : null },
    { headers: { 'cache-control': 'no-store' } },
  )
}
