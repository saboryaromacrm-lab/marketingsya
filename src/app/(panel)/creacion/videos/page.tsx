import { Cabecera } from '@/components/Cabecera'
import { listarBiblioteca } from '@/lib/video/propios/biblioteca'
import { MAX_DURACION_SUBIDA, MAX_SUBIDA, PEDAZO } from '@/lib/video/propios/reglas'
import { MenuCreacion } from '../MenuCreacion'
import { MisVideos } from './MisVideos'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mis videos' }

export default async function PaginaMisVideos() {
  const videos = await listarBiblioteca()
  return (
    <>
      <Cabecera titulo="Creación" subtitulo="Tus videos para armar reels e historias con la marca encima." miga={[{ texto: 'Creación', href: '/creacion' }, { texto: 'Mis videos' }]} />
      <div className="dos-columnas">
        <MenuCreacion />
        <div className="columna-principal">
          <MisVideos inicial={videos} limites={{ tamano: MAX_SUBIDA, duracion: MAX_DURACION_SUBIDA, pedazo: PEDAZO }} />
        </div>
      </div>
    </>
  )
}
