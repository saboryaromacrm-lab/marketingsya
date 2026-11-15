// Arregla textos con doble codificación, por ejemplo «MAÃ‘ANITA» → «MAÑANITA».
//
// Pasa cuando un texto UTF-8 se leyó como Windows-1252 (cp1252) y se volvió a guardar.
// Ojo: no alcanza con latin1. En «Ã‘», la comilla ‘ es el byte 0x91 de cp1252,
// que en latin1 no existe. Por eso se usa la tabla cp1252.

const CP1252_A_BYTE: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

// Un carácter que puede ser el primer byte de una letra UTF-8 de 2 a 4 bytes (Â–ô),
// seguido de uno o más que pueden ser bytes de continuación (0x80–0xBF en cp1252).
const CONTINUACION = '\\u0080-\\u00BF' + Object.keys(CP1252_A_BYTE).join('')
const SOSPECHOSO = new RegExp(`[\\u00C2-\\u00F4][${CONTINUACION}]+`, 'g')

const utf8 = new TextDecoder('utf-8', { fatal: true })

function aByte(c: string): number | null {
  const code = c.charCodeAt(0)
  if (code < 0x100) return code
  return CP1252_A_BYTE[c] ?? null
}

export function arreglarCodificacion(texto: string): string {
  if (!texto) return texto
  return texto.replace(SOSPECHOSO, (fragmento) => {
    const bytes: number[] = []
    for (const c of fragmento) {
      const b = aByte(c)
      if (b === null) return fragmento
      bytes.push(b)
    }
    try {
      return utf8.decode(new Uint8Array(bytes))
    } catch {
      // No era doble codificación (por ejemplo «Ãº» escrito a propósito): se deja igual.
      return fragmento
    }
  })
}
