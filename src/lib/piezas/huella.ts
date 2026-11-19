import { createHash } from 'node:crypto'

// Huella de una pieza: el HTML de todas sus placas, resumido. Si cambia la pieza, un precio, una foto o los datos
// de contacto, cambia la huella; así se sabe si la última exportación sigue al día.
export const huellaDe = (htmls: string[]) => createHash('sha256').update(htmls.join('\u0000')).digest('base64url').slice(0, 32)
