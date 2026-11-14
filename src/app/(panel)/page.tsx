import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { resumenCatalogo } from '@/lib/catalogo/consultas'
import { ultimaSincronizacionBuena } from '@/lib/catalogo/iniciar'
import { cuando, numero, plural } from '@/lib/formato'

export default async function Inicio() {
  const [r, ultima] = await Promise.all([resumenCatalogo(), ultimaSincronizacionBuena()])
  const irAlCatalogo = <Link className="btn btn-pri btn-chico" href="/catalogo">Ir al catálogo</Link>
  return (
    <div className="contenido">
      <Cabecera titulo="Inicio" subtitulo="Resumen de la plataforma de marketing de Sabor y Aroma." />
      {!ultima ? (
        <Aviso tono="ambar" dato="El catálogo todavía no está importado:" accion={irAlCatalogo}>
          se trae del ERP con el botón «Sincronizar ahora».
        </Aviso>
      ) : (
        <Aviso tono="verde" dato={`${numero(r.activos)} productos y ${numero(r.marcas)} marcas`} accion={irAlCatalogo}>
          en el catálogo. Última sincronización {cuando(ultima.terminadaEn ?? ultima.creadoEn)}.
        </Aviso>
      )}
      {ultima && r.sinFoto > 0 && (
        <Aviso tono="ambar" dato={`${plural(r.sinFoto, 'producto no tiene', 'productos no tienen')} foto:`}>
          no se pueden usar en piezas hasta que subas una.
        </Aviso>
      )}
    </div>
  )
}
