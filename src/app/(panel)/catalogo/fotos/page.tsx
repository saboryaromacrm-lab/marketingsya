import type { Metadata } from 'next'
import { FotosEnLote } from '@/components/catalogo/FotosEnLote'

export const metadata: Metadata = { title: 'Fotos en lote' }

export default function PaginaFotosEnLote() {
  return (
    <>
      <div>
        <h2 className="titulo-seccion">Fotos en lote</h2>
        <p className="texto-suave">
          Elegí muchas fotos de una vez. Cada una va al producto cuyo <b>código de barras</b>, <b>código</b> o <b>ID</b> coincide con el nombre del archivo
          (por ejemplo <code>7790387015317.jpg</code>). Antes de subir ves a dónde va cada una.
        </p>
      </div>
      <FotosEnLote />
    </>
  )
}
