import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { borrarAjuste, guardarAjuste, leerAjuste } from '@/lib/ajustes'
import { esMismoOrigen } from '@/lib/mismo-origen'
import { borrarMedia, guardarMedia } from '@/lib/media'

// Logo de la plataforma: se achica a 512 px como máximo, respetando proporción y transparencia (PNG).
const error = (mensaje: string, status: number) => Response.json({ error: mensaje }, { status })

export async function POST(req: Request) {
  if (!esMismoOrigen(req)) return error('Pedido no permitido.', 403)
  const archivo = (await req.formData().catch(() => null))?.get('logo')
  if (!(archivo instanceof File)) return error('No llegó ningún archivo.', 400)
  if (archivo.size > 5 * 1024 * 1024) return error('El logo pesa más de 5 MB.', 413)
  let png: Buffer
  try {
    png = await sharp(Buffer.from(await archivo.arrayBuffer()), { density: 300 })
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
  } catch {
    return error('No es una imagen válida. Usá PNG, SVG, WebP o JPG.', 422)
  }
  const anterior = await leerAjuste('logo')
  const ruta = `marca/logo-${Date.now()}.png`
  await guardarMedia(ruta, png)
  await guardarAjuste('logo', ruta)
  await borrarMedia(anterior)
  revalidatePath('/', 'layout')
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  if (!esMismoOrigen(req)) return error('Pedido no permitido.', 403)
  const anterior = await leerAjuste('logo')
  await borrarAjuste('logo')
  await borrarMedia(anterior)
  revalidatePath('/', 'layout')
  return Response.json({ ok: true })
}
