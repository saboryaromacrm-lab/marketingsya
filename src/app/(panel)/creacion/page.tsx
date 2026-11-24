import { Cabecera } from '@/components/Cabecera'
import { leerConfig } from '@/lib/configuracion'
import { estadoIA } from '@/lib/ia/claude'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { disponibilidad } from '@/lib/ia/disponibilidad'
import { proximasFechas } from '@/lib/ia/fechas-especiales'
import { hoyFormosa } from '@/lib/promos/fechas'
import { urlMedia } from '@/lib/media'
import { elegidosConFoto } from './acciones'
import { MenuCreacion } from './MenuCreacion'
import { Asistente } from './Asistente'
import { listaParaPiezas, opcionesListaPiezas } from '@/lib/catalogo/lista-piezas'
import { DIAS_NUEVOS, leerFiltrosLista, tipoDe } from '@/lib/catalogo/lista-piezas-reglas'
import { listasDisponibles } from '@/lib/promos/editor'

export const dynamic = 'force-dynamic'
// Siempre al día al volver: lo que muestra cambia solo o desde otra pantalla (no se reusa lo visto, ver staleTimes en next.config)
export const unstable_dynamicStaleTime = 0
export const metadata = { title: 'Nueva pieza' }

export default async function NuevaPieza({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const config = await leerConfig()
  const tipo = tipoDe(q.tipo)
  let filtros = leerFiltrosLista(q, tipo)
  const [elegidos, ia, opciones, listas] = await Promise.all([elegidosConFoto(), estadoIA(config), opcionesListaPiezas(), listasDisponibles()])
  let inicial = await listaParaPiezas(filtros, config.piezas.listaId)
  // Lanzamiento sin productos nuevos: se muestran los de mayor stock y se avisa
  let aviso: string | null = null
  if (filtros.nuevos && inicial.total === 0 && !q.orden) {
    filtros = { ...filtros, nuevos: false, orden: 'stock' }
    inicial = await listaParaPiezas(filtros, config.piezas.listaId)
    aviso = `No hay productos nuevos en los últimos ${DIAS_NUEVOS} días: te mostramos los de mayor stock.`
  }
  const fecha = proximasFechas(hoyFormosa(), 45)[0] ?? null
  return (
    <>
      <Cabecera titulo="Creación" subtitulo="Armá carruseles, historias y reels desde tu catálogo, con tu marca." miga={[{ texto: 'Creación' }, { texto: 'Nueva pieza' }]} />
      <div className="dos-columnas">
        <MenuCreacion />
        <div className="columna-principal">
          <Asistente
            elegidos={elegidos.map((e) => ({ id: e.id, nombre: e.nombre, foto: e.foto ? urlMedia(e.foto) : null }))}
            formatos={config.creacion.formatos}
            fecha={fecha ? `${fecha.nombre} (${fecha.fecha.slice(8, 10)}/${fecha.fecha.slice(5, 7)})` : null}
            ia={disponibilidad(ia, aprox(costoEstimado(config.ia.modelo, 'sugerencias')))}
            tipoInicial={tipo}
            listaProductos={{ filtros, inicial, opciones, listaNombre: listas.find((l) => l.id === config.piezas.listaId)?.nombre ?? 'Minorista', aviso }}
          />
        </div>
      </div>
    </>
  )
}
