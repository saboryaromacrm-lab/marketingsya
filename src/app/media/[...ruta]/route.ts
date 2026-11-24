import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { rutaSegura, TIPO_POR_EXTENSION } from '@/lib/media'
import { miniatura } from '@/lib/miniaturas-servidor'

// Sirve los archivos de MEDIA_DIR sin pedir sesión (Meta los tiene que poder leer).
// Los nombres llevan la versión adentro, así que se pueden cachear para siempre.
export async function GET(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await params
  // Miniaturas: /media/mini/<ancho>/<ruta>. Se generan la primera vez y después se sirven como cualquier archivo.
  if (ruta[0] === 'mini') {
    const hecha = await miniatura(Number(ruta[1]), ruta.slice(2).map(decodeURIComponent).join('/'))
    if (!hecha) return new Response('No encontrado', { status: 404 })
    const datos = await readFile(hecha)
    return new Response(new Uint8Array(datos), {
      headers: { 'content-type': 'image/webp', 'content-length': String(datos.length), 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
    })
  }
  const relativa = ruta.map(decodeURIComponent).join('/')
  const archivo = rutaSegura(relativa)
  const tipo = TIPO_POR_EXTENSION[path.extname(relativa).slice(1).toLowerCase()]
  if (!archivo || !tipo) return new Response('No encontrado', { status: 404 })
  try {
    const info = await stat(archivo)
    if (!info.isFile()) return new Response('No encontrado', { status: 404 })
    const comunes = { 'content-type': tipo, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes' }
    // Pedazos («Range»): los reproductores de video del celular los piden para empezar a ver y adelantar
    const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '')
    if (rango && (rango[1] || rango[2])) {
      const desde = rango[1] ? Number(rango[1]) : Math.max(0, info.size - Number(rango[2]))
      const hasta = rango[1] && rango[2] ? Math.min(Number(rango[2]), info.size - 1) : info.size - 1
      if (desde > hasta || desde >= info.size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${info.size}` } })
      return new Response(Readable.toWeb(createReadStream(archivo, { start: desde, end: hasta })) as ReadableStream, {
        status: 206,
        headers: { ...comunes, 'content-length': String(hasta - desde + 1), 'content-range': `bytes ${desde}-${hasta}/${info.size}` },
      })
    }
    return new Response(Readable.toWeb(createReadStream(archivo)) as ReadableStream, {
      headers: {
        'accept-ranges': 'bytes',
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
