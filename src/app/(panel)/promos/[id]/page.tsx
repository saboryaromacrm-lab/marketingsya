import { notFound } from 'next/navigation'
import { cargarPromo } from '@/lib/promos/datos'
import { cantidadElegidos, infoProductos, listasDisponibles, placasDe, ultimaExportacion, type DatosEditor } from '@/lib/promos/editor'
import { erpSinFoto, filasDelErp } from '@/lib/promos/datos'
import { EditorPromo } from './EditorPromo'
import { leerConfig } from '@/lib/configuracion'
import { estadoIA } from '@/lib/ia/claude'
import { disponibilidad } from '@/lib/ia/disponibilidad'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { listarMusica } from '@/lib/video/musica'
import { ANIMACION_INICIAL, limpiarAnimacion } from '@/lib/video/tipos'

export const metadata = { title: 'Promo' }
// Siempre al día al volver: lo que muestra cambia solo o desde otra pantalla (no se reusa lo visto, ver staleTimes en next.config)
export const unstable_dynamicStaleTime = 0

export default async function PaginaPromo({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const d = await cargarPromo(id)
  if (!d) notFound()
  const ids = [...d.productos.keys()]
  const config = await leerConfig()
  const [info, placas, listas, exportacion, elegidos, erp, sinFoto, estado, musica] = await Promise.all([
    infoProductos(ids), placasDe(id), listasDisponibles(), ultimaExportacion(d.promo.exportacionId), cantidadElegidos(), filasDelErp(), erpSinFoto(), estadoIA(config), listarMusica(),
  ])
  const { promo } = d
  const datos: DatosEditor = {
    titulo: promo.titulo, desde: promo.desde, hasta: promo.hasta, listaId: promo.listaId, diseno: promo.diseno, formatos: promo.formatos, textoPosteo: promo.textoPosteo, animacion: limpiarAnimacion(promo.animacion, { ...ANIMACION_INICIAL, ...config.creacion.animacion }),
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
      erpSinFoto={sinFoto.filter((p) => !presentes.has(p.id))}
      descuentoInicial={config.piezas.descuento}
      contacto={config.contacto}
      hashtags={config.ia.hashtags}
      ia={disponibilidad(estado, aprox(costoEstimado(config.ia.modelo, 'texto')))}
      musica={musica}
    />
  )
}
