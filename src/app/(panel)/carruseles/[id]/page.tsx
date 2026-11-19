import { notFound } from 'next/navigation'
import { cargarCarrusel, planDePlacas } from '@/lib/carruseles/datos'
import { idsDe } from '@/lib/carruseles/tipos'
import { listasDisponibles, ultimaExportacion } from '@/lib/promos/editor'
import { cantidadElegidosCarrusel, infoProductosCarrusel } from '../acciones'
import { EditorCarrusel } from './EditorCarrusel'

export const metadata = { title: 'Carrusel' }

export default async function PaginaCarrusel({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const c = await cargarCarrusel(id)
  if (!c) notFound()
  const [info, listas, exportacion, elegidos] = await Promise.all([
    infoProductosCarrusel(idsDe(c.carrusel.estilo, c.datos), c.carrusel.listaId), listasDisponibles(), ultimaExportacion(c.carrusel.exportacionId), cantidadElegidosCarrusel(),
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
    />
  )
}
