# Imagen de la plataforma para Dokploy.
# Se compila en 3 etapas y la imagen final solo lleva lo necesario para correr (salida «standalone» de Next).
# Debian (bookworm) y no Alpine: sharp, la herramienta de fotos, trae binarios para glibc.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Dependencias (se reaprovecha mientras no cambie package-lock.json)
FROM base AS dependencias
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2) Compilación
FROM base AS compilacion
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) Imagen final
FROM base AS final
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_DIR=/app/media \
    MIGRACIONES_DIR=/app/drizzle
COPY --from=compilacion --chown=node:node /app/.next/standalone ./
COPY --from=compilacion --chown=node:node /app/.next/static ./.next/static
COPY --from=compilacion --chown=node:node /app/drizzle ./drizzle
# Chromium sin pantalla para pasar las placas a JPEG, con las librerías y fuentes del sistema que necesita.
# Se instala con el mismo playwright-core que usa la app, así la versión siempre coincide.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN node node_modules/playwright-core/cli.js install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/*
# La carpeta de fotos es un volumen: se crea con el dueño correcto para que la app pueda escribir.
RUN mkdir -p /app/media && chown node:node /app/media
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
