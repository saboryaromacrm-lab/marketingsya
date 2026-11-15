import { revalidatePath } from 'next/cache'
import { FotoInvalida, TAMANO_MAXIMO } from '@/lib/catalogo/fotos'
import { guardarFotoPropia, ProductoInexistente, quitarFotoPropia } from '@/lib/catalogo/fotos-propias'
import { esMismoOrigen } from '@/lib/mismo-origen'
import { urlMedia } from '@/lib/media'

// Subir (POST, campo «foto») o quitar (DELETE) la foto propia de un producto.
// Es una ruta y no una acción de servidor porque las acciones cortan en 1 MB y una foto de celular pesa más.

async function leerId(params: Promise<{ id: string }>) {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

const error = (mensaje: string, status: number) => Response.json({ error: mensaje }, { status })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!esMismoOrigen(req)) return error('Pedido no permitido.', 403)
  const id = await leerId(params)
  if (!id) return error('Producto inválido.', 400)
  if (Number(req.headers.get('content-length') ?? 0) > TAMANO_MAXIMO + 1024 * 1024) return error('La foto pesa más de 20 MB.', 413)

  let archivo: FormDataEntryValue | null
  try {
    archivo = (await req.formData()).get('foto')
  } catch {
    return error('No llegó ninguna foto.', 400)
  }
  if (!(archivo instanceof File)) return error('No llegó ninguna foto.', 400)

  try {
    const r = await guardarFotoPropia(id, Buffer.from(await archivo.arrayBuffer()))
    revalidatePath('/catalogo', 'layout')
    return Response.json({ ok: true, url: urlMedia(r.cuadrada), ancho: r.ancho, alto: r.alto })
  } catch (e) {
    if (e instanceof FotoInvalida) return error(e.message, 422)
    if (e instanceof ProductoInexistente) return error('Ese producto no existe.', 404)
    console.error('[foto]', e)
    return error('No se pudo guardar la foto. Probá de nuevo.', 500)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!esMismoOrigen(req)) return error('Pedido no permitido.', 403)
  const id = await leerId(params)
  if (!id) return error('Producto inválido.', 400)
  try {
    await quitarFotoPropia(id)
    revalidatePath('/catalogo', 'layout')
    return Response.json({ ok: true })
  } catch (e) {
    if (e instanceof ProductoInexistente) return error('Ese producto no existe.', 404)
    console.error('[foto]', e)
    return error('No se pudo quitar la foto.', 500)
  }
}
