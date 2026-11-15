import type { NextConfig } from 'next'

const config: NextConfig = {
  // Imagen de Docker chica para Dokploy: solo lo necesario para correr.
  output: 'standalone',
  poweredByHeader: false,
  // pg y pg-boss usan módulos nativos de Node: no se empaquetan.
  serverExternalPackages: ['pg', 'pg-boss'],
  experimental: {
    // La protección de rutas (proxy.ts) guarda el cuerpo del pedido en memoria y, por defecto,
    // lo corta en 10 MB sin avisar: una foto más pesada llegaría rota. Las fotos tienen tope de 20 MB.
    proxyClientMaxBodySize: '25mb',
  },
}

export default config
