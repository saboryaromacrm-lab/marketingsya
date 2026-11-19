import { notFound } from 'next/navigation'
import { cargarCarrusel, planDePlacas } from '@/lib/carruseles/datos'
import { idsDe } from '@/lib/carruseles/tipos'
import { listasDisponibles, ultimaExportacion } from '@/lib/promos/editor'
import { leerConfig } from '@/lib/configuracion'
import { estadoIA } from '@/lib/ia/claude'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { disponibilidad } from '@/lib/ia/disponibilidad'
import { cantidadElegidosCarrusel, infoProductosCarrusel } from '../acciones'
import { EditorCarrusel } from './EditorCarrusel'

export const metadata = { title: 'Carrusel' }

export default async function PaginaCarrusel({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const c = await cargarCarrusel(id)
  if (!c) notFound()
  const config = await leerConfig()
  const [info, listas, exportacion, elegidos, estado] = await Promise.all([
    infoProductosCarrusel(idsDe(c.carrusel.estilo, c.datos), c.carrusel.listaId), listasDisponibles(), ultimaExportacion(c.carrusel.exportacionId), cantidadElegidosCarrusel(), estadoIA(config),
  ])
  return (
    <EditorCarrusel
      id={id}
      inicial={{ titulo: c.carrusel.titulo, estilo: c.carrusel.estilo, listaId: c.carrusel.listaId, datos: c.datos, textoPosteo: c.carrusel.textoPosteo }}
      infoInicial={info}
      placasIniciales={planDePlacas(c).map(({ numero, nombre, ruta }) => ({ numero, nombre, ruta }))}
      listas={listas}
      exportacionInicial={exportacion}
      elegidos={elegidos}
      contacto={config.contacto}
      hashtags={config.ia.hashtags}
      ia={disponibilidad(estado, aprox(costoEstimado(config.ia.modelo, 'texto')))}
    />
  )
}
