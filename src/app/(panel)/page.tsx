import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { resumenCatalogo } from '@/lib/catalogo/consultas'
import { ultimaSincronizacionBuena } from '@/lib/catalogo/iniciar'
import { cuando, numero, plural } from '@/lib/formato'
import { estadoIA } from '@/lib/ia/claude'
import { dolares } from '@/lib/ia/precios'

export default async function Inicio() {
  const [r, ultima, ia] = await Promise.all([resumenCatalogo(), ultimaSincronizacionBuena(), estadoIA()])
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
      {!ia.conectada ? (
        <Aviso tono="ambar" dato="El asesor con IA todavía no está conectado:" accion={<Link className="btn btn-chico" href="/configuracion/asesor">Conectar</Link>}>
          cargá la clave de Anthropic en Configuración.
        </Aviso>
      ) : (
        <Aviso tono={ia.aviso ? 'ambar' : 'verde'} dato={`IA: ${dolares(ia.gasto)} de ${dolares(ia.tope)} este mes`} accion={<Link className="btn btn-chico" href="/asesor">Ir al asesor</Link>}>
          {ia.cortada ? 'Llegaste al tope: vuelve el día 1.' : ia.aviso ? `Ya usaste el ${Math.round((ia.gasto / ia.tope) * 100)} % del tope.` : 'Ideas, calendario, recetas y textos.'}
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
