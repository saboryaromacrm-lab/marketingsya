import { cargarPromo, planDePlacas } from '@/lib/promos/datos'
import { htmlFlyer } from '@/lib/promos/flyer'
import { respuestaHtml } from '@/lib/piezas/html'

// Una placa del flyer: /render/promo/12?formato=historia&pagina=1
// La abre Chromium (con firma) para exportar, y Lucas (con su sesión) en la vista previa del editor.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const q = new URL(req.url).searchParams
  const datos = Number.isInteger(id) ? await cargarPromo(id) : null
  if (!datos) return new Response('No existe esa promo', { status: 404 })
  const placa = planDePlacas(datos).find((p) => p.formato === q.get('formato') && p.pagina === Number(q.get('pagina') ?? 1))
  if (!placa) return new Response('No existe esa placa', { status: 404 })
  return respuestaHtml(htmlFlyer(placa.datos))
}
