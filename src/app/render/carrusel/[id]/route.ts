import { cargarCarrusel, htmlDePlaca } from '@/lib/carruseles/datos'
import { respuestaHtml } from '@/lib/piezas/html'
import { envolverHistoria } from '@/lib/carruseles/historia'

// Una placa de carrusel: /render/carrusel/7?placa=2 (con &formato=historia, la versión 1080×1920 para historias)
// La abre Chromium (con firma) para exportar, y Lucas (con su sesión) en la vista previa del editor.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const q = new URL(req.url).searchParams
  const n = Number(q.get('placa') ?? 1)
  const c = Number.isInteger(id) ? await cargarCarrusel(id) : null
  if (!c) return new Response('No existe ese carrusel', { status: 404 })
  const html = Number.isInteger(n) ? htmlDePlaca(c, n) : null
  if (!html) return new Response('No existe esa placa', { status: 404 })
  return respuestaHtml(q.get('formato') === 'historia' ? envolverHistoria(html, c.carrusel.estilo, c.contacto) : html)
}
