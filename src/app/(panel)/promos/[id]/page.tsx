import { notFound } from 'next/navigation'
import { cargarPromo } from '@/lib/promos/datos'
import { cantidadElegidos, infoProductos, listasDisponibles, placasDe, ultimaExportacion, type DatosEditor } from '@/lib/promos/editor'
import { filasDelErp } from '@/lib/promos/datos'
import { EditorPromo } from './EditorPromo'

export const metadata = { title: 'Promo' }

export default async function PaginaPromo({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const d = await cargarPromo(id)
  if (!d) notFound()
  const ids = [...d.productos.keys()]
  const [info, placas, listas, exportacion, elegidos, erp] = await Promise.all([
    infoProductos(ids), placasDe(id), listasDisponibles(), ultimaExportacion(d.promo.exportacionId), cantidadElegidos(), filasDelErp(),
  ])
  const { promo } = d
  const datos: DatosEditor = {
    titulo: promo.titulo, desde: promo.desde, hasta: promo.hasta, listaId: promo.listaId, diseno: promo.diseno, formatos: promo.formatos,
    filas: d.filas.map((f) => ({ tipo: f.tipo, titulo: f.titulo, descuento: f.descuento, cantidadMinima: f.cantidadMinima, precioFijo: f.precioFijo, origen: f.origen, productos: f.productos })),
  }
  const presentes = new Set(ids)
  return (
    <EditorPromo
      id={id}
      inicial={datos}
      infoInicial={info}
      placasIniciales={placas}
      listas={listas}
      exportacionInicial={exportacion}
      elegidos={elegidos}
      erpFaltantes={erp.filter((f) => !presentes.has(f.productos[0].id)).length}
    />
  )
}
