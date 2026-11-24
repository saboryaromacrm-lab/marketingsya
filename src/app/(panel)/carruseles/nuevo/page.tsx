import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { plural } from '@/lib/formato'
import { ESTILOS } from '@/lib/carruseles/tipos'
import type { EstiloCarrusel } from '@/lib/db/esquema'
import { cantidadElegidosCarrusel, crearCarrusel } from '../acciones'

export const metadata = { title: 'Nuevo carrusel' }

export default async function NuevoCarrusel() {
  const elegidos = await cantidadElegidosCarrusel()
  return (
    <div className="contenido">
      <Cabecera titulo="Nuevo carrusel" subtitulo="Elegí el estilo. Después cambiás productos y textos en el editor." miga={[{ texto: 'Carruseles', href: '/carruseles' }, { texto: 'Nuevo' }]} />
      {elegidos ? (
        <Aviso tono="verde" dato={`${plural(elegidos, 'producto elegido', 'productos elegidos')}`}>con las casillas del catálogo: se usan en el carrusel.</Aviso>
      ) : (
        <Aviso tono="ambar" dato="No elegiste productos" accion={<Link prefetch={false} className="btn btn-chico" href="/catalogo">Ir al catálogo</Link>}>
          con las casillas del catálogo: el carrusel arranca vacío y los elegís en el editor.
        </Aviso>
      )}
      <div className="elegir-estilo">
        {(Object.keys(ESTILOS) as EstiloCarrusel[]).map((e) => (
          <form key={e} action={crearCarrusel.bind(null, e)} className="tarjeta opcion-estilo">
            <img src={`/interfaz/carrusel-${e}.jpg`} alt="" />
            <b>{ESTILOS[e].nombre}</b>
            <span className="texto-chico">{ESTILOS[e].descripcion}</span>
            <button className="btn btn-pri">Usar este estilo</button>
          </form>
        ))}
      </div>
    </div>
  )
}
