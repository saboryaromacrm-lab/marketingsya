import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import { cuando, numero, plural } from '@/lib/formato'
import { cantidadElegidos, listarPromos } from '@/lib/promos/editor'
import { estadoPromo, textoVigencia, type EstadoPromo } from '@/lib/promos/fechas'
import { urlMedia } from '@/lib/media'
import { crearPromoDesdeSeleccion, duplicarPromo } from './acciones'

export const metadata = { title: 'Promos' }

const ESTADOS: Record<EstadoPromo, { texto: string; clase: string }> = {
  vigente: { texto: 'VIGENTE', clase: 'chip-ok' },
  'por-empezar': { texto: 'POR EMPEZAR', clase: 'chip-en_cola' },
  vencida: { texto: 'VENCIDA', clase: 'chip-excluido' },
}

export default async function Promos() {
  const [lista, elegidos] = await Promise.all([listarPromos(), cantidadElegidos()])
  const nueva = (
    <form action={crearPromoDesdeSeleccion}>
      <button className="btn btn-pri"><Icono nombre="add" />{elegidos ? `Armar promo con ${plural(elegidos, 'elegido', 'elegidos')}` : 'Nueva promo'}</button>
    </form>
  )
  return (
    <div className="contenido">
      <Cabecera titulo="Promos" subtitulo="Flyers de promociones para historias, WhatsApp y el feed. Solo diseñan: no cambian precios en el ERP." miga={[{ texto: 'Promos' }]} acciones={nueva} />

      {elegidos === 0 && (
        <Aviso tono="verde" dato="Para armar una promo," accion={<Link prefetch={false} className="btn btn-chico" href="/catalogo">Ir al catálogo</Link>}>
          elegí los productos con las casillas del catálogo y apretá «Armar promo». Las promos cargadas en la lista Promo del ERP se suman solas.
        </Aviso>
      )}

      {lista.length === 0 ? (
        <div className="vacio">
          <Icono nombre="sell" tamano={40} />
          <p><b>Todavía no armaste ninguna promo.</b></p>
        </div>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla-clic tabla-promos">
            <thead>
              <tr><th>Promo</th><th>Vigencia</th><th>Estado</th><th className="num">Productos</th><th>Modificada</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const estado = ESTADOS[estadoPromo(p.desde, p.hasta)]
                return (
                  <tr key={p.id}>
                    <td>
                      <Link prefetch={false} href={`/promos/${p.id}`} className="fila-enlace">{p.titulo}</Link>
                      <div className="texto-chico">N.º {p.id} · diseño {p.diseno}</div>
                    </td>
                    <td>{textoVigencia(p.desde, p.hasta).toLowerCase()}</td>
                    <td><span className={`chip ${estado.clase}`}>{estado.texto}</span></td>
                    <td className="num">{numero(p.productos)}<div className="texto-chico">{plural(p.filas, 'fila', 'filas')}</div></td>
                    <td>{cuando(p.actualizadoEn)}</td>
                    <td className="celda-acciones">
                      {p.estadoExportacion === 'ok' && p.zip && (
                        <a className="btn btn-chico" href={urlMedia(p.zip)} download><Icono nombre="download" tamano={16} />.zip</a>
                      )}
                      <form action={duplicarPromo.bind(null, p.id)}>
                        <button className="btn btn-chico"><Icono nombre="content_copy" tamano={16} />Duplicar</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
