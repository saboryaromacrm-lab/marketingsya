import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// La fuente de íconos está recortada a los que usa la plataforma. Si alguien usa un ícono nuevo, esta prueba avisa:
// hay que correr scripts/iconos/recortar.py (ver el comentario de ese archivo).
const raiz = path.resolve(__dirname, '../../..')
const todos = new Set<string>(JSON.parse(readFileSync(path.join(raiz, 'scripts/iconos/todos.json'), 'utf8')))
const incluidos = new Set<string>(JSON.parse(readFileSync(path.join(raiz, 'scripts/iconos/incluidos.json'), 'utf8')))

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? archivos(p) : /\.tsx?$/.test(n) ? [p] : []
  })
}

describe('fuente de íconos recortada', () => {
  it('trae todos los íconos que usa el código', () => {
    const faltan = new Set<string>()
    for (const a of archivos(path.join(raiz, 'src'))) {
      const t = readFileSync(a, 'utf8')
      const nombres = [...t.matchAll(/['"`]([a-z0-9_]+)['"`]/g), ...t.matchAll(/material-icons[^>]*>\s*([a-z0-9_]+)\s*</g)].map((m) => m[1])
      for (const n of nombres) if (todos.has(n) && !incluidos.has(n)) faltan.add(`${n} (${path.relative(raiz, a)})`)
    }
    expect([...faltan], 'Faltan íconos en la fuente: corré «python3 scripts/iconos/recortar.py»').toEqual([])
  })
  it('es chica', () => {
    expect(statSync(path.join(raiz, 'src/styles/fuentes/material-icons-sya.woff2')).size).toBeLessThan(20 * 1024)
  })
})
