import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { resumenCatalogo } from '@/lib/catalogo/consultas'
import { ultimaSincronizacionBuena } from '@/lib/catalogo/iniciar'
import { cuando, numero, plural } from '@/lib/formato'
import { estadoIA } from '@/lib/ia/claude'
import { dolares } from '@/lib/ia/precios'
import { resumenPublicaciones } from '@/lib/publicaciones/resumen'
import { textoCuando } from '@/lib/publicaciones/reglas'
import { resumenPautas } from '@/lib/pautas/motor'
import { pesos } from '@/lib/pautas/reglas'

export default async function Inicio() {
  const [r, ultima, ia, pub, pau] = await Promise.all([resumenCatalogo(), ultimaSincronizacionBuena(), estadoIA(), resumenPublicaciones(), resumenPautas()])
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
      {pub.fallidas.length > 0 && (
        <Aviso tono="ambar" dato={`${plural(pub.fallidas.length, 'publicación falló', 'publicaciones fallaron')}:`} accion={<Link className="btn btn-chico" href="/publicaciones?ver=error">Revisar</Link>}>
          «{pub.fallidas[0].titulo}»{pub.fallidas[0].error ? `. ${pub.fallidas[0].error}` : ''}
        </Aviso>
      )}
      {!pub.metaConectada ? (
        <Aviso tono="ambar" dato="Meta todavía no está conectado:" accion={<Link className="btn btn-chico" href="/configuracion/meta">Conectar</Link>}>
          cargá el token en Configuración › Meta para publicar en Instagram y Facebook.
        </Aviso>
      ) : pub.proxima ? (
        <Aviso tono="verde" dato={`Próxima publicación ${textoCuando(pub.proxima.programadaPara)}:`} accion={<Link className="btn btn-chico" href="/publicaciones?ver=programadas">Ver</Link>}>
          «{pub.proxima.titulo}»{pub.programadas > 1 ? ` y ${plural(pub.programadas - 1, 'más programada', 'más programadas')}` : ''}.
        </Aviso>
      ) : (
        <Aviso tono="verde" dato="Nada programado para publicar." accion={<Link className="btn btn-chico" href="/carruseles">Ir a carruseles</Link>}>
          Abrí un carrusel o una promo y tocá «Publicar».
        </Aviso>
      )}
      {pau.rechazadas.length > 0 && (
        <Aviso tono="ambar" dato={`Meta rechazó o frenó ${pau.rechazadas.length === 1 ? 'una pauta' : `${pau.rechazadas.length} pautas`}:`} accion={<Link className="btn btn-chico" href="/pautas?ver=rechazadas">Ver</Link>}>
          «{pau.rechazadas[0].titulo}»{pau.rechazadas[0].motivo ? `. ${pau.rechazadas[0].motivo}` : ''}
        </Aviso>
      )}
      {pub.metaConectada && (
        <Aviso tono={pau.tope > 0 && pau.comprometido >= pau.tope * 0.8 ? 'ambar' : 'verde'} dato={`Pautas: ${pesos(pau.gastado)} gastados este mes`} accion={<Link className="btn btn-chico" href="/pautas">Ir a pautas</Link>}>
          {pau.conectada ? `${pesos(pau.comprometido)} comprometidos de ${pesos(pau.tope)} · ${pau.activas} ${pau.activas === 1 ? 'activa' : 'activas'}${pau.enRevision ? ` · ${pau.enRevision} en revisión` : ''}.` : 'Falta detectar la cuenta publicitaria en Configuración › Pautas.'}
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
