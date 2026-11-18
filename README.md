# Plataforma de marketing · Sabor y Aroma

Contexto del proyecto en [`CLAUDE.md`](CLAUDE.md) y sistema de diseño de la interfaz en [`DISENO.md`](DISENO.md).

## Desarrollo local

Necesita Node 22 o más nuevo y PostgreSQL 16.

1. Copiá `.env.example` a `.env` y completá `DATABASE_URL` y `CODIGO_INSTALACION`.
2. Instalá las dependencias: `npm install`
3. Levantá la app: `npm run dev`. Las tablas se crean solas al arrancar.
4. Entrá: la primera vez te pide el código de instalación y que crees el PIN (de 4 a 8 números).

## Instalación en el servidor

Ver [`docs/INSTALACION.md`](docs/INSTALACION.md): Dokploy con `docker-compose.yml` (app, base propia y copia diaria).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | App en modo desarrollo |
| `npm run build` | Compila para producción (salida `standalone` para Docker) |
| `npm test` | Corre las pruebas |
| `npm run lint` | Revisa los tipos de TypeScript |
| `npm run db:generar` | Genera una migración nueva a partir de `src/lib/db/esquema.ts` |
| `npm run db:migrar` | Aplica las migraciones pendientes (también se aplican solas al arrancar) |
| `npm run clave -- "…"` | Genera un hash de contraseña (solo para desarrollo, `CLAVE_HASH`) |

## Probar desde una sesión de Claude Code en la nube

La red pasa por un proxy: para que `fetch` de Node lo use, arrancá el servidor con `NODE_USE_ENV_PROXY=1`.
