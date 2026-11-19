// Generador de QR mínimo (modo byte, nivel de corrección M, versiones 1 a 6), sin bibliotecas.
// Es el mismo algoritmo que el QR de la tienda que Lucas probó con el celular (19/11/2026).
// Así el QR sale solo de la dirección que se cargue en Configuración.

const EXP = new Array<number>(512).fill(0)
const LOG = new Array<number>(256).fill(0)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function generador(n: number): number[] {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const g2 = new Array<number>(g.length + 1).fill(0)
    g.forEach((c, j) => { g2[j] ^= c; g2[j + 1] ^= mul(c, EXP[i]) })
    g = g2
  }
  return g
}

/** Códigos de corrección Reed-Solomon. */
export function reedSolomon(datos: number[], n: number): number[] {
  const g = generador(n)
  const r = [...datos, ...new Array<number>(n).fill(0)]
  for (let i = 0; i < datos.length; i++) {
    const c = r[i]
    if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c)
  }
  return r.slice(datos.length)
}

// Versión: [codewords totales, ec por bloque, bloques] para nivel M
const TABLA_M: Record<number, [number, number, number]> = { 1: [26, 10, 1], 2: [44, 16, 1], 3: [70, 26, 1], 4: [100, 18, 2], 5: [134, 24, 2], 6: [172, 16, 4] }
const ALINEACION: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] }

function codificar(texto: string): { v: number; cw: number[] } {
  const datos = [...new TextEncoder().encode(texto)]
  let v = 0
  for (const [k, [tot, ec, bl]] of Object.entries(TABLA_M)) {
    if (tot - ec * bl - 2 >= datos.length) { v = Number(k); break }
  }
  if (!v) throw new Error('La dirección es demasiado larga para el QR')
  const [tot, ec, bl] = TABLA_M[v]
  const ndatos = tot - ec * bl
  let bits = '0100' + datos.length.toString(2).padStart(8, '0') + datos.map((b) => b.toString(2).padStart(8, '0')).join('')
  bits += '0'.repeat(Math.min(4, ndatos * 8 - bits.length))
  bits += '0'.repeat((8 - (bits.length % 8)) % 8)
  const cw: number[] = []
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8), 2))
  for (let k = 0; cw.length < ndatos; k++) cw.push(k % 2 ? 0x11 : 0xec)
  const tam = ndatos / bl
  const bloques = Array.from({ length: bl }, (_, i) => cw.slice(i * tam, (i + 1) * tam))
  const ecs = bloques.map((b) => reedSolomon(b, ec))
  const final: number[] = []
  for (let i = 0; i < tam; i++) for (const b of bloques) final.push(b[i])
  for (let i = 0; i < ec; i++) for (const e of ecs) final.push(e[i])
  return { v, cw: final }
}

const MASCARAS: ((f: number, c: number) => boolean)[] = [
  (f, c) => (f + c) % 2 === 0,
  (f) => f % 2 === 0,
  (_f, c) => c % 3 === 0,
  (f, c) => (f + c) % 3 === 0,
  (f, c) => (Math.floor(f / 2) + Math.floor(c / 3)) % 2 === 0,
  (f, c) => ((f * c) % 2) + ((f * c) % 3) === 0,
  (f, c) => (((f * c) % 2) + ((f * c) % 3)) % 2 === 0,
  (f, c) => (((f + c) % 2) + ((f * c) % 3)) % 2 === 0,
]

function formato(m: number): number {
  const d = (0b00 << 3) | m
  let r = d << 10
  for (let i = 14; i > 9; i--) if (r & (1 << i)) r ^= 0x537 << (i - 10)
  return ((d << 10) | r) ^ 0x5412
}

/** Matriz del QR (true = módulo oscuro). */
export function matrizQR(texto: string): boolean[][] {
  const { v, cw } = codificar(texto)
  const n = 17 + 4 * v
  const M: (boolean | null)[][] = Array.from({ length: n }, () => new Array<boolean | null>(n).fill(null))
  const R: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const poner = (f: number, c: number, val: boolean) => { M[f][c] = val; R[f][c] = true }
  const buscador = (f0: number, c0: number) => {
    for (let f = -1; f < 8; f++) for (let c = -1; c < 8; c++) {
      const ff = f0 + f, cc = c0 + c
      if (ff < 0 || ff >= n || cc < 0 || cc >= n) continue
      const dentro = f >= 0 && f <= 6 && c >= 0 && c <= 6
      poner(ff, cc, dentro && (f === 0 || f === 6 || c === 0 || c === 6 || (f >= 2 && f <= 4 && c >= 2 && c <= 4)))
    }
  }
  buscador(0, 0); buscador(0, n - 7); buscador(n - 7, 0)
  for (let i = 8; i < n - 8; i++) { poner(6, i, i % 2 === 0); poner(i, 6, i % 2 === 0) }
  const pos = ALINEACION[v]
  for (const a of pos) for (const b of pos) {
    if (R[a][b]) continue
    for (let f = -2; f <= 2; f++) for (let c = -2; c <= 2; c++) poner(a + f, b + c, Math.max(Math.abs(f), Math.abs(c)) !== 1)
  }
  poner(4 * v + 9, 8, true)
  for (let i = 0; i < 9; i++) { if (!R[8][i]) poner(8, i, false); if (!R[i][8]) poner(i, 8, false) }
  for (let i = 0; i < 8; i++) { poner(8, n - 1 - i, false); poner(n - 1 - i, 8, false) }
  const bits = cw.map((b) => b.toString(2).padStart(8, '0')).join('')
  let k = 0
  let arriba = true
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c -= 1
    for (let i = 0; i < n; i++) {
      const f = arriba ? n - 1 - i : i
      for (const cc of [c, c - 1]) {
        if (!R[f][cc]) { M[f][cc] = k < bits.length && bits[k] === '1'; k++ }
      }
    }
    arriba = !arriba
  }
  const conMascara = (m: number): boolean[][] => {
    const A = M.map((fila, f) => fila.map((x, c) => (R[f][c] ? !!x : MASCARAS[m](f, c) !== !!x)))
    const fmt = formato(m)
    const b = Array.from({ length: 15 }, (_, i) => ((fmt >> i) & 1) === 1)
    const pos1: [number, number][] = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
    pos1.forEach(([f, c], i) => { A[f][c] = b[14 - i] })
    for (let i = 0; i < 7; i++) A[n - 1 - i][8] = b[14 - i]
    for (let i = 0; i < 8; i++) A[8][n - 8 + i] = b[7 - i]
    A[4 * v + 9][8] = true
    return A
  }
  const penal = (A: boolean[][]): number => {
    let p = 0
    const transpuesta = A[0].map((_, c) => A.map((fila) => fila[c]))
    for (const filas of [A, transpuesta]) {
      for (const fila of filas) {
        let cuenta = 1
        for (let i = 1; i < n; i++) {
          if (fila[i] === fila[i - 1]) cuenta++
          else { if (cuenta >= 5) p += cuenta - 2; cuenta = 1 }
        }
        if (cuenta >= 5) p += cuenta - 2
        const s = fila.map((x) => (x ? '1' : '0')).join('')
        p += 40 * ((s.match(/10111010000/g)?.length ?? 0) + (s.match(/00001011101/g)?.length ?? 0))
      }
    }
    for (let f = 0; f < n - 1; f++) for (let c = 0; c < n - 1; c++) if (A[f][c] === A[f + 1][c] && A[f][c] === A[f][c + 1] && A[f][c] === A[f + 1][c + 1]) p += 3
    const oscuros = Math.floor((A.reduce((s, fila) => s + fila.filter(Boolean).length, 0) * 100) / (n * n))
    return p + Math.floor(Math.abs(oscuros - 50) / 5) * 10
  }
  let mejor = 0
  let menor = Infinity
  for (let m = 0; m < 8; m++) { const pm = penal(conMascara(m)); if (pm < menor) { menor = pm; mejor = m } }
  return conMascara(mejor)
}

/** QR en SVG (con margen blanco de 4 módulos), en el verde de la marca. */
export function qrSvg(texto: string, color = '#0b3b2e'): string {
  const A = matrizQR(texto)
  const n = A.length
  const q = 4
  let rects = ''
  A.forEach((fila, f) => fila.forEach((x, c) => { if (x) rects += `<rect x="${c + q}" y="${f + q}" width="1" height="1"/>` }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="${color}">${rects}</g></svg>`
}

export const qrDataUri = (texto: string) => `data:image/svg+xml;base64,${Buffer.from(qrSvg(texto)).toString('base64')}`
