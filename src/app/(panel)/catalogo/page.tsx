import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'

export default function Catalogo() {
  return (
    <div className="contenido">
      <Cabecera
        titulo="Catálogo"
        subtitulo="Copia del catálogo del ERP para armar piezas. Se actualiza con el botón, no solo."
        miga={[{ texto: 'Catálogo' }]}
        acciones={
          <button className="btn btn-pri" disabled title="Se activa en el paso 2">
            <Icono nombre="sync" />
            Sincronizar ahora
          </button>
        }
      />
      <div className="vacio">
        <Icono nombre="inventory_2" tamano={40} />
        <p><b>Todavía no hay productos.</b> El importador llega en el paso 2.</p>
      </div>
    </div>
  )
}
