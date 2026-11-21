import { revalidatePath } from 'next/cache'
import { esMismoOrigen } from '@/lib/mismo-origen'
import { PEDAZO } from '@/lib/video/propios/reglas'
import { recibirPedazo, terminarSubida } from '@/lib/video/propios/biblioteca'

// Un pedazo de la subida (cuerpo en crudo). «desde» es lo que ya llegó: si se corta, se sigue desde ahí.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!esMismoOrigen(req)) return Response.json({ error: 'Pedido no permitido.' }, { status: 403 })
  const { id } = await params
  const desde = Number(new URL(req.url).searchParams.get('desde'))
  if (!Number.isInteger(desde) || desde < 0) return Response.json({ error: 'Falta desde dónde sigue.' }, { status: 400 })
  if (Number(req.headers.get('content-length') ?? 0) > PEDAZO) return Response.json({ error: 'El pedazo es demasiado grande.' }, { status: 413 })
  const datos = new Uint8Array(await req.arrayBuffer())
  const r = await recibirPedazo(Number(id), desde, datos)
  return Response.json(r, { status: 'error' in r ? 409 : 200 })
}

// Llegó todo: se pone en la cola para comprimirlo a 1080p.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!esMismoOrigen(req)) return Response.json({ error: 'Pedido no permitido.' }, { status: 403 })
  const { id } = await params
  const r = await terminarSubida(Number(id))
  revalidatePath('/creacion/videos')
  return Response.json(r, { status: 'error' in r ? 422 : 200 })
}
