import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { armarZip } from '../zip'

describe('armarZip', () => {
  it('un .zip que Python abre y verifica, con nombres con tildes', () => {
    const archivos = [
      { nombre: 'placa-1.jpg', datos: Buffer.from('uno'.repeat(1000)) },
      { nombre: 'Promoción ñandú.jpg', datos: Buffer.from([0, 1, 2, 255]) },
      { nombre: 'vacío.txt', datos: Buffer.alloc(0) },
    ]
    const dir = mkdtempSync(path.join(tmpdir(), 'zip-'))
    const ruta = path.join(dir, 'prueba.zip')
    writeFileSync(ruta, armarZip(archivos))
    // Python verifica el CRC de cada archivo (testzip) y lista los nombres
    const salida = execFileSync('python3', ['-I', '-c', `
import zipfile, sys, json
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print(json.dumps([[i.filename, i.file_size, z.read(i).hex()[:8]] for i in z.infolist()], ensure_ascii=False))
`, ruta]).toString()
    expect(JSON.parse(salida)).toEqual([
      ['placa-1.jpg', 3000, Buffer.from('unou').toString('hex')],
      ['Promoción ñandú.jpg', 4, '000102ff'],
      ['vacío.txt', 0, ''],
    ])
    expect(readFileSync(ruta).subarray(0, 4).toString('hex')).toBe('504b0304')
  })
})
