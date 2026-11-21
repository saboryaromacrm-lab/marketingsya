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

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nueva pieza' }

export default async function NuevaPieza() {
  const config = await leerConfig()
  const [elegidos, ia] = await Promise.all([elegidosConFoto(), estadoIA(config)])
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
          />
        </div>
      </div>
    </>
  )
}
