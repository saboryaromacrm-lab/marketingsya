// Procesa las fotos que sube Lucas. Función pura sobre buffers: no toca disco ni base.
//
// De cada foto salen dos versiones en WebP:
// - «original»: la misma foto, derecha (según el celular) y achicada a 1600 px como máximo;
// - «cuadrada»: 1200×1200 con fondo blanco, como las del ERP, lista para las piezas.

import sharp, { type Metadata } from 'sharp'

export const TAMANO_MAXIMO = 20 * 1024 * 1024
const LADO_ORIGINAL = 1600
const LADO_CUADRADA = 1200
const MINIMO = 300 // más chica que esto se ve pixelada en una pieza de 1080 px

export class FotoInvalida extends Error {}

// Las fotos HEIC del iPhone no se pueden abrir con esta herramienta: se reconocen por su firma
// para dar un mensaje claro. (Desde Safari normalmente se suben ya convertidas a JPG.)
function esHeic(b: Buffer) {
  const marca = b.subarray(4, 12).toString('latin1')
  return marca.startsWith('ftyp') && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(marca.slice(4))
}

export async function procesarFoto(datos: Buffer): Promise<{ original: Buffer; cuadrada: Buffer; ancho: number; alto: number }> {
  if (datos.length === 0) throw new FotoInvalida('El archivo está vacío.')
  if (datos.length > TAMANO_MAXIMO) throw new FotoInvalida('La foto pesa más de 20 MB.')
  if (esHeic(datos)) {
    throw new FotoInvalida('Es una foto HEIC del iPhone y no se puede usar. En el iPhone: Ajustes › Cámara › Formatos › «Más compatible», o compartila como JPG.')
  }

  let meta: Metadata
  try {
    meta = await sharp(datos).metadata()
  } catch {
    throw new FotoInvalida('No es una imagen o está dañada. Usá JPG, PNG o WebP.')
  }
  if (!meta.format || !['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'].includes(meta.format)) {
    throw new FotoInvalida('Formato no admitido. Usá JPG, PNG o WebP.')
  }
  // Ancho y alto ya girados según la orientación que guardó la cámara
  const girada = (meta.orientation ?? 1) >= 5
  const ancho = (girada ? meta.height : meta.width) ?? 0
  const alto = (girada ? meta.width : meta.height) ?? 0
  if (Math.max(ancho, alto) < MINIMO) throw new FotoInvalida(`La foto es muy chica (${ancho}×${alto}). Tiene que tener al menos ${MINIMO} px de lado.`)

  const base = () => sharp(datos, { animated: false }).rotate()
  const [original, cuadrada] = await Promise.all([
    base().resize({ width: LADO_ORIGINAL, height: LADO_ORIGINAL, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer(),
    base()
      .flatten({ background: '#ffffff' }) // lo transparente queda blanco
      .resize({ width: LADO_CUADRADA, height: LADO_CUADRADA, fit: 'contain', background: '#ffffff' })
      .webp({ quality: 86 })
      .toBuffer(),
  ])
  return { original, cuadrada, ancho, alto }
}
