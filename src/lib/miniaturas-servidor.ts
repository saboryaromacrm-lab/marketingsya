import 'server-only'
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { rutaSegura } from '@/lib/media'
import { esAnchoMini } from '@/lib/miniaturas'

// Genera (una sola vez) la miniatura de una imagen de /media y devuelve dónde quedó. null si no corresponde.
// Si la llegan a pedir varias pantallas a la vez, se genera una sola vez.

const enCurso = new Map<string, Promise<string | null>>()

export async function miniatura(ancho: number, relativa: string): Promise<string | null> {
  if (!esAnchoMini(ancho) || relativa.startsWith('mini/') || !/\.(webp|jpe?g|png)$/i.test(relativa)) return null
  const origen = rutaSegura(relativa)
  const destino = rutaSegura(`mini/${ancho}/${relativa}`)
  if (!origen || !destino) return null
  const [o, d] = await Promise.all([stat(origen).catch(() => null), stat(destino).catch(() => null)])
  if (!o?.isFile()) return null
  if (d && d.mtimeMs >= o.mtimeMs) return destino
  const clave = destino
  const ya = enCurso.get(clave)
  if (ya) return ya
  const trabajo = (async () => {
    try {
      // Se gira según la foto del celular, se achica a ese ancho (nunca se agranda) y se guarda en WebP
      const datos = await sharp(origen).rotate().resize({ width: ancho, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
      await mkdir(path.dirname(destino), { recursive: true })
      const temporal = `${destino}.${process.pid}.tmp`
      await writeFile(temporal, datos)
      await rename(temporal, destino)
      return destino
    } catch (e) {
      console.error('[miniatura]', relativa, e instanceof Error ? e.message : e)
      return null
    } finally {
      enCurso.delete(clave)
    }
  })()
  enCurso.set(clave, trabajo)
  return trabajo
}

/** Borra las miniaturas cuya imagen original ya no existe (piezas, videos o fotos borradas). Corre con la limpieza de cada hora. */
export async function limpiarMiniaturas() {
  const base = rutaSegura('mini')
  if (!base) return
  const { readdir, rm } = await import('node:fs/promises')
  let n = 0
  const recorrer = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const completa = path.join(dir, e.name)
      if (e.isDirectory()) { await recorrer(completa); continue }
      // mini/<ancho>/<ruta original>
      const original = rutaSegura(path.relative(base, completa).split(path.sep).slice(1).join('/'))
      if (original && !(await stat(original).catch(() => null))) { await rm(completa, { force: true }); n++ }
    }
  }
  await recorrer(base)
  if (n) console.log(`[miniaturas] limpieza: se borraron ${n}`)
}
