import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { rutaSegura, TIPO_POR_EXTENSION } from '@/lib/media'

// Sirve los archivos de MEDIA_DIR sin pedir sesión (Meta los tiene que poder leer).
// Los nombres llevan la versión adentro, así que se pueden cachear para siempre.
export async function GET(_req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await params
  const relativa = ruta.map(decodeURIComponent).join('/')
  const archivo = rutaSegura(relativa)
  const tipo = TIPO_POR_EXTENSION[path.extname(relativa).slice(1).toLowerCase()]
  if (!archivo || !tipo) return new Response('No encontrado', { status: 404 })
  try {
    const info = await stat(archivo)
    if (!info.isFile()) return new Response('No encontrado', { status: 404 })
    return new Response(Readable.toWeb(createReadStream(archivo)) as ReadableStream, {
      headers: {
        'content-type': tipo,
        'content-length': String(info.size),
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        ...(tipo === 'application/zip' ? { 'content-disposition': `attachment; filename="${path.basename(relativa)}"` } : {}),
      },
    })
  } catch {
    return new Response('No encontrado', { status: 404 })
  }
}
