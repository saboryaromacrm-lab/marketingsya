// Next llama a register() una vez al arrancar el servidor.
// Acá se pone a trabajar la cola de tareas (solo en el servidor de Node, no en el navegador).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (!process.env.DATABASE_URL) return
  const { arrancarTrabajador } = await import('./lib/catalogo/trabajador')
  arrancarTrabajador().catch((e) => console.error('[cola] no pudo arrancar:', e))
}
