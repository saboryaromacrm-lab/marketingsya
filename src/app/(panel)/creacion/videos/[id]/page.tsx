import { notFound } from 'next/navigation'
import { leerConfig } from '@/lib/configuracion'
import { estadoIA } from '@/lib/ia/claude'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { disponibilidad } from '@/lib/ia/disponibilidad'
import { listasDisponibles } from '@/lib/promos/editor'
import { listarMusica } from '@/lib/video/musica'
import { bibliotecaLista, cargarPiezaVideo } from '@/lib/video/propios/datos'
import { accionResumenPieza } from '../acciones'
import { EditorVideo } from './EditorVideo'

export const dynamic = 'force-dynamic'
// Siempre al día al volver: lo que muestra cambia solo o desde otra pantalla (no se reusa lo visto, ver staleTimes en next.config)
export const unstable_dynamicStaleTime = 0
export const metadata = { title: 'Video propio' }

export default async function PaginaVideoPropio({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const d = await cargarPiezaVideo(id)
  if (!d) notFound()
  const config = await leerConfig()
  const [resumen, biblioteca, listas, musica, estado] = await Promise.all([accionResumenPieza(id), bibliotecaLista(), listasDisponibles(), listarMusica(), estadoIA(config)])
  return (
    <EditorVideo
      id={id}
      inicial={{ titulo: d.pieza.titulo, contenido: d.contenido, formatos: d.formatos, textoPosteo: d.pieza.textoPosteo }}
      resumenInicial={resumen}
      biblioteca={biblioteca}
      listas={listas}
      musica={musica}
      ia={disponibilidad(estado, aprox(costoEstimado(config.ia.modelo, 'texto')))}
    />
  )
}
