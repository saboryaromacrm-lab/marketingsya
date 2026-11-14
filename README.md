# Plataforma de marketing · Sabor y Aroma

Contexto del proyecto en [`CLAUDE.md`](CLAUDE.md) y sistema de diseño de la interfaz en [`DISENO.md`](DISENO.md).

## Desarrollo local

Necesita Node 22 o más nuevo y PostgreSQL 16.

1. Copiá `.env.example` a `.env` y completalo:
   - `CLAVE_HASH`: `npm run clave -- "tu-contraseña"`
   - `SESION_SECRETO`: `openssl rand -hex 32`
   - `MEDIA_DIR`: carpeta para fotos y piezas (en Dokploy, un volumen)
2. Instalá las dependencias: `npm install`
3. Creá las tablas: `npm run db:migrar` (con las variables del `.env` cargadas)
4. Levantá la app: `npm run dev`

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | App en modo desarrollo |
| `npm run build` | Compila para producción (salida `standalone` para Docker) |
| `npm test` | Corre las pruebas |
| `npm run lint` | Revisa los tipos de TypeScript |
| `npm run db:generar` | Genera una migración nueva a partir de `src/lib/db/esquema.ts` |
| `npm run db:migrar` | Aplica las migraciones pendientes |
| `npm run clave -- "…"` | Genera el hash de la contraseña de ingreso |

## Probar desde una sesión de Claude Code en la nube

La red pasa por un proxy: para que `fetch` de Node lo use, arrancá el servidor con `NODE_USE_ENV_PROXY=1`.
