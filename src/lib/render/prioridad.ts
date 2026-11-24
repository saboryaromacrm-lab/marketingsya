import 'server-only'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Lo pesado (codificar videos con ffmpeg y armar piezas con Chromium) corre con prioridad baja:
// si al mismo tiempo alguien navega la plataforma o usa el ERP (comparten servidor), ellos van primero.
export const PRIORIDAD_BAJA = 10

/** Baja la prioridad de un proceso recién lanzado (si no se puede, sigue igual). */
export function bajarPrioridad(pid: number | undefined) {
  if (!pid) return
  try { os.setPriority(pid, PRIORIDAD_BAJA) } catch { /* sin permiso o ya terminó: no frena nada */ }
}

/**
 * Chromium abre sus procesos hijos al arrancar, así que la prioridad se pone desde el lanzamiento:
 * un guion chico que lo ejecuta con «nice». Devuelve la ruta del guion, o la original si no se puede.
 */
export async function chromiumConPrioridadBaja(ejecutable: string): Promise<string> {
  try {
    const dir = path.join(os.tmpdir(), 'sya-chromium')
    await mkdir(dir, { recursive: true })
    const guion = path.join(dir, 'chromium-prioridad-baja.sh')
    await writeFile(guion, `#!/bin/sh\nexec nice -n ${PRIORIDAD_BAJA} "${ejecutable.replace(/"/g, '\\"')}" "$@"\n`)
    await chmod(guion, 0o755)
    return guion
  } catch {
    return ejecutable
  }
}
