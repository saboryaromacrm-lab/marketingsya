// Genera el hash de la contraseña para la variable CLAVE_HASH.
// Uso: npm run clave -- "la-contraseña"
import { hashearClave } from '../src/lib/auth/clave.ts'

const clave = process.argv[2]
if (!clave || clave.length < 8) {
  console.error('Pasá una contraseña de al menos 8 caracteres: npm run clave -- "la-contraseña"')
  process.exit(1)
}
console.log(`CLAVE_HASH=${await hashearClave(clave)}`)
