import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { cuando, plural } from '@/lib/formato'
import { urlMedia } from '@/lib/media'
import { ESTILOS, idsDe, limpiarDatos, placasDe } from '@/lib/carruseles/tipos'
import { duplicarCarrusel, listarCarruseles } from './acciones'

export const metadata = { title: 'Carruseles' }

export default async function Carruseles() {
  const lista = await listarCarruseles()
  return (
    <div className="contenido">
      <Cabecera
        titulo="Carruseles"
        subtitulo="Carruseles de Instagram con los 3 estilos aprobados (1080×1350). Las fotos y los precios salen del catálogo."
        miga={[{ texto: 'Carruseles' }]}
        acciones={<Link className="btn btn-pri" href="/carruseles/nuevo"><Icono nombre="add" />Nuevo carrusel</Link>}
      />
      {lista.length === 0 ? (
        <div className="vacio">
          <Icono nombre="view_carousel" tamano={40} />
          <p><b>Todavía no armaste ningún carrusel.</b></p>
          <p>Elegí productos con las casillas del <Link href="/catalogo">catálogo</Link> y apretá «Armar carrusel», o empezá de cero con «Nuevo carrusel».</p>
        </div>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla-clic tabla-promos">
            <thead><tr><th>Carrusel</th><th>Estilo</th><th className="num">Placas</th><th>Estado</th><th>Modificado</th><th></th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const d = limpiarDatos(c.estilo, c.datos)
                const exportado = c.estadoExportacion === 'ok' && c.zip
                return (
                  <tr key={c.id}>
                    <td><Link href={`/carruseles/${c.id}`} className="fila-enlace">{c.titulo}</Link><div className="texto-chico">N.º {c.id} · {plural(idsDe(c.estilo, d).length, 'producto', 'productos')}</div></td>
                    <td>{ESTILOS[c.estilo].nombre}</td>
                    <td className="num">{placasDe(c.estilo, d).length}</td>
                    <td><span className={`chip ${exportado ? 'chip-ok' : 'chip-en_cola'}`}>{exportado ? 'EXPORTADO' : 'BORRADOR'}</span></td>
                    <td>{cuando(c.actualizadoEn)}</td>
                    <td className="celda-acciones">
                      {exportado && <a className="btn btn-chico" href={urlMedia(c.zip!)} download><Icono nombre="download" tamano={16} />.zip</a>}
                      <form action={duplicarCarrusel.bind(null, c.id)}><button className="btn btn-chico"><Icono nombre="content_copy" tamano={16} />Duplicar</button></form>
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
