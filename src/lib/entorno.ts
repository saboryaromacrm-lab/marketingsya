// Lee y valida las variables de entorno una sola vez.
// Si falta algo, el error dice qué falta y cómo generarlo.

function requerida(nombre: string, ayuda: string): string {
  const valor = process.env[nombre]
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. ${ayuda}`)
  return valor
}

export const entorno = {
  get databaseUrl() {
    return requerida('DATABASE_URL', 'Ejemplo: postgres://usuario:clave@host:5432/marketing')
  },
  // Opcional, solo para desarrollo: si no se creó la contraseña desde la pantalla, se acepta este hash.
  get claveHashEntorno() {
    return process.env.CLAVE_HASH || null
  },
  // Código que pide la pantalla de primera vez para crear la contraseña (lo escribe Lucas en Dokploy).
  get codigoInstalacion() {
    return process.env.CODIGO_INSTALACION || null
  },
  // Si viene vacío, se genera solo al arrancar y se guarda en la base (ver instrumentation.ts).
  get sesionSecreto() {
    const s = requerida('SESION_SECRETO', 'Se genera solo al arrancar el servidor; si ves esto, el arranque falló.')
    if (s.length < 32) throw new Error('SESION_SECRETO tiene que tener al menos 32 caracteres.')
    return s
  },
  // Carpeta donde se guardan fotos y piezas. En Dokploy es un volumen para que no se pierdan.
  get mediaDir() {
    return process.env.MEDIA_DIR || `${process.cwd()}/media`
  },
  get catalogoUrl() {
    return process.env.CATALOGO_URL || 'https://api.saboryaroma.com/api/catalogo-externo'
  },
  get sesionDias() {
    const n = Number(process.env.SESION_DIAS ?? 30)
    return Number.isFinite(n) && n > 0 ? n : 30
  },
}
