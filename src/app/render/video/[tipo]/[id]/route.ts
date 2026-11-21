import { respuestaHtml } from '@/lib/piezas/html'
import { videoDe } from '@/lib/video/piezas'
import { esFormatoVideo } from '@/lib/video/tipos'

// Video animado de una pieza: /render/video/carrusel/12?formato=reel (&vista=1 para que se reproduzca solo).
// Lo abre Chromium (con firma) para grabarlo cuadro por cuadro, y Lucas (con su sesión) en la vista previa.
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = await params
  const q = new URL(req.url).searchParams
  const formato = q.get('formato')
  if ((tipo !== 'carrusel' && tipo !== 'promo') || !esFormatoVideo(formato)) return new Response('No existe ese video', { status: 404 })
  const v = await videoDe(tipo, Number(id), formato, q.get('vista') === '1')
  if (!v) return new Response('No existe esa pieza', { status: 404 })
  return respuestaHtml(v.html)
}
