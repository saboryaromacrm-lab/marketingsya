import { esMismoOrigen } from '@/lib/mismo-origen'
import { crearSubida } from '@/lib/video/propios/biblioteca'

// Empezar a subir un video a «Mis videos»: { nombre, tamano } → { id, pedazo }.
// Después van los pedazos (PUT /api/videos/N?desde=…) y al final POST /api/videos/N para que se prepare.
// Son rutas y no acciones de servidor porque las acciones cortan en 1 MB.
export async function POST(req: Request) {
  if (!esMismoOrigen(req)) return Response.json({ error: 'Pedido no permitido.' }, { status: 403 })
  let datos: { nombre?: unknown; tamano?: unknown }
  try { datos = await req.json() } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const r = await crearSubida({ nombre: String(datos.nombre ?? ''), tamano: Number(datos.tamano) })
  return Response.json(r, { status: 'error' in r ? 422 : 200 })
}
