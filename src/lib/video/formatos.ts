// Formatos de entrada de una promo nueva: las imágenes de Configuración › Piezas y los videos de Configuración › Creación.
import type { Config } from '@/lib/configuracion-tipos'
import type { FormatosPromo } from '@/lib/db/esquema'

export const formatosNuevaPromo = (c: Config): FormatosPromo => ({
  ...c.piezas.formatos,
  reel: c.creacion.formatos.reel,
  historiaVideo: c.creacion.formatos.historiaVideo,
  videoFeed: c.creacion.formatos.videoFeed,
})
