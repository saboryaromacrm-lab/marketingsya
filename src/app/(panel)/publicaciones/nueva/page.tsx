import { notFound } from 'next/navigation'
import { leerConfig } from '@/lib/configuracion'
import { estadoMeta } from '@/lib/meta/conexion'
import { cargarPieza, diaDeLaIdea, exportacionDe, type TipoPieza } from '@/lib/publicaciones/piezas'
import { partesFormosa, textoAlternativo } from '@/lib/publicaciones/reglas'
import { esFecha, sumarDias } from '@/lib/promos/fechas'
import { estadoIA } from '@/lib/ia/claude'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { disponibilidad } from '@/lib/ia/disponibilidad'
import { cuando } from '@/lib/formato'
import { Publicar } from './Publicar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Publicar' }

type Q = { carrusel?: string; promo?: string; fecha?: string }

export default async function NuevaPublicacion({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams
  const tipo: TipoPieza | null = q.carrusel ? 'carrusel' : q.promo ? 'promo' : null
  const pieza = tipo ? await cargarPieza(tipo, Number(q.carrusel ?? q.promo)) : null
  if (!pieza) notFound()
  const config = await leerConfig()
  const [exp, meta, idea, ia] = await Promise.all([exportacionDe(pieza), estadoMeta(), esFecha(q.fecha) ? Promise.resolve(q.fecha) : diaDeLaIdea(pieza.tipo, pieza.id), estadoIA(config)])

  // Día y hora sugeridos: el de la idea del calendario (si no pasó), si no hoy o mañana a la hora de Configuración
  const ahora = partesFormosa(new Date())
  const soloHistorias = pieza.placas.every((p) => p.grupo === 'historia')
  const hora = soloHistorias ? config.meta.horaHistoria : config.meta.horaFeed
  const conIdea = !!idea && (idea > ahora.fecha || (idea === ahora.fecha && hora > ahora.hora))
  const fecha = conIdea ? idea! : hora > ahora.hora ? ahora.fecha : sumarDias(ahora.fecha, 1)

  return (
    <Publicar
      pieza={{ tipo: pieza.tipo, id: pieza.id, titulo: pieza.titulo, subtitulo: pieza.subtitulo, editar: pieza.editar, productos: pieza.productos, sinFoto: pieza.sinFoto, bajas: pieza.bajas }}
      placas={pieza.placas.map((p) => ({ ...p, imagen: exp?.alDia ? exp.imagenes[p.indice] ?? null : null }))}
      exportacion={exp ? { alDia: exp.alDia, cuando: exp.terminadoEn ? cuando(exp.terminadoEn) : null } : null}
      textoInicial={pieza.texto}
      altInicial={config.meta.textoAlt ? textoAlternativo(pieza.tipo, pieza.titulo, pieza.nombres) : null}
      destinosIniciales={config.meta.destinos}
      sugerencia={{ modo: conIdea ? 'programar' : 'ahora', fecha, hora, deLaIdea: conIdea }}
      horas={{ feed: config.meta.horaFeed, historia: config.meta.horaHistoria }}
      meta={{ conectada: meta.conectada, pagina: meta.cuentas?.paginaNombre ?? null, instagram: meta.cuentas?.instagramUsuario ?? (meta.cuentas?.instagramId ? 'Instagram' : null) }}
      ia={disponibilidad(ia, aprox(costoEstimado(config.ia.modelo, 'texto')))}
    />
  )
}
