import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'

export default function Inicio() {
  return (
    <div className="contenido">
      <Cabecera titulo="Inicio" subtitulo="Resumen de la plataforma de marketing de Sabor y Aroma." />
      {/* Paso 2: este aviso pasa a leer de la base cuántos productos hay y cuándo fue la última sincronización. */}
      <Aviso
        tono="ambar"
        dato="El catálogo todavía no está importado:"
        accion={<Link className="btn btn-pri btn-chico" href="/catalogo">Ir al catálogo</Link>}
      >
        se trae del ERP con el botón «Sincronizar ahora».
      </Aviso>
    </div>
  )
}
