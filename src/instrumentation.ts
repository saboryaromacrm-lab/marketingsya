// Next llama a register() una vez al arrancar el servidor, antes de atender pedidos.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (!process.env.DATABASE_URL) return
  const { aplicarMigraciones, reiniciarClaveSiSePide, asegurarSecretoDeSesion } = await import('./lib/arranque')
  // Si la base no está lista, mejor que el contenedor falle y Dokploy lo reinicie.
  await aplicarMigraciones()
  await reiniciarClaveSiSePide()
  await asegurarSecretoDeSesion()
  const { arrancarTrabajador } = await import('./lib/catalogo/trabajador')
  arrancarTrabajador().catch((e) => console.error('[cola] no pudo arrancar:', e))
}
