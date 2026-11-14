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
  get claveHash() {
    return requerida('CLAVE_HASH', 'Generala con: npm run clave -- "tu-contraseña"')
  },
  get sesionSecreto() {
    const s = requerida('SESION_SECRETO', 'Generalo con: openssl rand -hex 32')
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
