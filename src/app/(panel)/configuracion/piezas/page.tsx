import { leerConfig } from '@/lib/configuracion'
import { listasDisponibles } from '@/lib/promos/editor'
import { FormPiezas } from '../Formularios'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Piezas' }

export default async function Piezas() {
  const [config, listas] = await Promise.all([leerConfig(), listasDisponibles()])
  return (
    <section className="tarjeta">
      <h2 className="titulo-seccion">Valores de entrada de las piezas</h2>
      <p className="texto-suave">Con qué arranca cada promo o carrusel nuevo. Después se cambia en cada uno.</p>
      <FormPiezas inicial={config.piezas} listas={listas} />
    </section>
  )
}
