import type { NextConfig } from 'next'

const config: NextConfig = {
  // Imagen de Docker chica para Dokploy: solo lo necesario para correr.
  output: 'standalone',
  poweredByHeader: false,
  // pg y pg-boss usan módulos nativos de Node: no se empaquetan.
  serverExternalPackages: ['pg', 'pg-boss', 'playwright-core'],
  // playwright-core lee archivos propios en tiempo de ejecución (por ejemplo browsers.json) que el
  // rastreo de dependencias no detecta: se copia el paquete entero a la salida standalone.
  outputFileTracingIncludes: { '/**': ['./node_modules/playwright-core/**'] },
  experimental: {
    // La protección de rutas (proxy.ts) guarda el cuerpo del pedido en memoria y, por defecto,
    // lo corta en 10 MB sin avisar: una foto más pesada llegaría rota. Las fotos tienen tope de 20 MB.
    proxyClientMaxBodySize: '25mb',
    // Volver a una sección vista hace menos de 30 s no la pide de nuevo (las acciones que cambian datos
    // revalidan y eso ya la vuelve a pedir). Las pantallas de carga (loading.tsx) se reusan 5 minutos.
    staleTimes: { dynamic: 30 },
  },
}

export default config
