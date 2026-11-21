import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { db, esquema } from '@/lib/db'
import { esMismoOrigen } from '@/lib/mismo-origen'
import { borrarMedia, guardarMedia, rutaSegura } from '@/lib/media'
import { duracionAudio } from '@/lib/render/video'

// Subir un tema a la biblioteca de música (campo «archivo» y «nombre»).
// Es una ruta y no una acción de servidor porque las acciones cortan en 1 MB.

const MAXIMO = 15 * 1024 * 1024
const EXTENSIONES = ['mp3', 'm4a', 'aac', 'wav', 'ogg']
const error = (mensaje: string, status: number) => Response.json({ error: mensaje }, { status })

export async function POST(req: Request) {
  if (!esMismoOrigen(req)) return error('Pedido no permitido.', 403)
  if (Number(req.headers.get('content-length') ?? 0) > MAXIMO + 1024 * 1024) return error('El tema pesa más de 15 MB.', 413)
  let datos: FormData
  try { datos = await req.formData() } catch { return error('No llegó ningún archivo.', 400) }
  const archivo = datos.get('archivo')
  if (!(archivo instanceof File)) return error('No llegó ningún archivo.', 400)
  const ext = (archivo.name.split('.').pop() ?? '').toLowerCase()
  if (!EXTENSIONES.includes(ext)) return error('El tema tiene que ser MP3, M4A, AAC, WAV u OGG.', 422)
  if (archivo.size > MAXIMO) return error('El tema pesa más de 15 MB.', 413)
  const nombre = (String(datos.get('nombre') ?? '').trim() || archivo.name.replace(/\.[^.]+$/, '')).slice(0, 60)
  const relativa = `musica/${randomBytes(8).toString('hex')}.${ext}`
  await guardarMedia(relativa, Buffer.from(await archivo.arrayBuffer()))
  // Se revisa que ffmpeg lo pueda leer (si no, no sirve para los videos)
  const duracion = await duracionAudio(rutaSegura(relativa)!)
  if (!duracion) {
    await borrarMedia(relativa)
    return error('No se pudo leer ese audio. Probá con un MP3.', 422)
  }
  const [t] = await db.insert(esquema.musica).values({ nombre, archivo: relativa, duracion: Math.round(duracion * 100) / 100 }).returning()
  revalidatePath('/configuracion/creacion')
  return Response.json({ ok: true, id: t.id })
}
