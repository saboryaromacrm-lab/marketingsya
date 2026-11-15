// Las rutas que cambian datos solo aceptan pedidos hechos desde la propia plataforma.
// (Las acciones de servidor de Next ya lo controlan solas; esto es para las rutas /api.)
export function esMismoOrigen(req: Request): boolean {
  const origen = req.headers.get('origin')
  if (!origen) return false
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origen).host === host
  } catch {
    return false
  }
}
