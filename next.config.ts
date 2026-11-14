import type { NextConfig } from 'next'

const config: NextConfig = {
  // Imagen de Docker chica para Dokploy: solo lo necesario para correr.
  output: 'standalone',
  poweredByHeader: false,
  // pg y pg-boss usan módulos nativos de Node: no se empaquetan.
  serverExternalPackages: ['pg', 'pg-boss'],
}

export default config
