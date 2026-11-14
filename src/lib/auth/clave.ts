import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// La contraseña nunca se guarda: se guarda un hash scrypt con su sal.
// Formato: scrypt:N:r:p:sal(base64):hash(base64)
// Separado con «:» y no con «$»: bash y docker compose interpretan «$» como variable
// y romperían el hash al cargarlo desde el entorno.

const scryptAsync = promisify(scrypt) as (
  clave: string, sal: Buffer, largo: number, opciones: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

const N = 2 ** 15, R = 8, P = 1, LARGO = 64
const maxmem = 128 * N * R * 2

export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16)
  const hash = await scryptAsync(clave, sal, LARGO, { N, r: R, p: P, maxmem })
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join(':')
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const partes = guardado.trim().split(':')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const [, n, r, p, sal64, hash64] = partes
  const esperado = Buffer.from(hash64, 'base64')
  if (esperado.length === 0) return false
  try {
    const obtenido = await scryptAsync(clave, Buffer.from(sal64, 'base64'), esperado.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
    })
    return timingSafeEqual(obtenido, esperado)
  } catch {
    // Parámetros inválidos (hash mal copiado): se trata como contraseña incorrecta.
    return false
  }
}
