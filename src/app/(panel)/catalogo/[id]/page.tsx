import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db, esquema } from '@/lib/db'
import { BotonVolver } from '@/components/BotonVolver'
import { Icono } from '@/components/Icono'
import { FotoProducto } from '@/components/catalogo/FotoProducto'
import { NombrePiezas } from '@/components/catalogo/NombrePiezas'
import { InterruptorPiezas } from '@/components/catalogo/InterruptorPiezas'
import { soloDistintos, ValorCambio } from '@/components/catalogo/ValorCambio'
import { normalizarTexto } from '@/lib/catalogo/busqueda'
import { NOMBRE_CAMBIO } from '@/lib/catalogo/etiquetas-cambios'
import { urlMedia } from '@/lib/media'
import { cuando, fechaHora, numero, pesos } from '@/lib/formato'
import type { Precio } from '@/lib/catalogo/tipos'

const { productos, marcas, listas, sincronizaciones, sincronizacionCambios } = esquema

async function cargar(id: number) {
  const [p] = await db
    .select({ p: productos, marca: marcas.nombre, logo: marcas.logoArchivo })
    .from(productos)
    .leftJoin(marcas, eq(marcas.id, productos.marcaId))
    .where(eq(productos.id, id))
  return p
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = Number((await params).id)
  const fila = Number.isInteger(id) ? await cargar(id) : undefined
  return { title: fila?.p.nombre ?? 'Producto' }
}

function FilasPrecios({ precios, nombreLista, fraccionado }: { precios: Precio[]; nombreLista: (id: number) => string; fraccionado?: string }) {
  return precios.map((x, i) => (
    <tr key={`${fraccionado}-${i}`}>
      {fraccionado !== undefined && <td>{fraccionado}</td>}
      <td>{nombreLista(x.listaId)}</td>
      <td className="num"><b>{pesos(x.precio)}</b>{x.unidades !== 1 && <div className="texto-chico">por unidad</div>}</td>
      <td className="num">{x.unidades !== 1 ? <>{pesos(x.precioFormato)}<div className="texto-chico">bulto de {numero(x.unidades)}</div></> : <span className="texto-suave">—</span>}</td>
      <td className="num">{x.unidadesMinimas > 0 ? numero(x.unidadesMinimas) : <span className="texto-suave">—</span>}</td>
    </tr>
  ))
}

export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const fila = await cargar(id)
  if (!fila) notFound()
  const { p, marca } = fila
  const erp = p.erp

  const [lsts, historial, todasLasMarcas] = await Promise.all([
    db.select().from(listas).orderBy(asc(listas.orden), asc(listas.id)),
    db
      .select({ c: sincronizacionCambios, fecha: sincronizaciones.creadoEn })
      .from(sincronizacionCambios)
      .innerJoin(sincronizaciones, eq(sincronizaciones.id, sincronizacionCambios.sincronizacionId))
      .where(and(eq(sincronizacionCambios.entidad, 'producto'), eq(sincronizacionCambios.entidadId, id)))
      .orderBy(desc(sincronizacionCambios.id))
      .limit(50),
    db.select({ id: marcas.id, nombre: marcas.nombre }).from(marcas),
  ])
  const nombreLista = (lid: number) => {
    const l = lsts.find((x) => x.id === lid)
    return l ? (l.nombre === l.modalidad ? l.nombre : `${l.modalidad} (${l.nombre})`) : `Lista ${lid}`
  }
  const marcasPorId = new Map(todasLasMarcas.map((m) => [m.id, m.nombre]))
  // La descripción del ERP casi siempre repite el nombre en mayúsculas: solo se muestra si agrega algo.
  const descripcion = erp.descripcion.replace(/^importado\s*·\s*/i, '')
  const descripcionUtil = descripcion && normalizarTexto(descripcion) !== normalizarTexto(p.nombre) ? erp.descripcion : null
  const hayPrecios = erp.precios.length > 0 || erp.presentaciones.some((pr) => pr.precios.length > 0)

  return (
    <>
      <div>
        <BotonVolver destino="/catalogo" texto="Productos" />
        <h2 className="titulo-seccion">{p.nombre}</h2>
        <div className="chips">
          {p.tipo === 'granel' && <span className="chip">A GRANEL</span>}
          {p.estado !== 'activo' && <span className="chip chip-cambio-precio">{p.estado.toUpperCase()}</span>}
          {p.dadoDeBaja && <span className="chip chip-error">DADO DE BAJA {p.bajaEn && `· ${fechaHora(p.bajaEn)}`}</span>}
          {p.excluirDePiezas && <span className="chip chip-excluido">NO VA EN PIEZAS</span>}
          {p.etiquetas.map((e) => <Link key={e} href={`/catalogo?etiqueta=${encodeURIComponent(e)}`} className="chip chip-filtro">{e}</Link>)}
        </div>
      </div>

      <div className="detalle">
        <FotoProducto
          productoId={p.id}
          nombre={p.nombre}
          propia={p.imagenPropiaArchivo ? urlMedia(p.imagenPropiaArchivo) : null}
          erp={p.imagenArchivo ? urlMedia(p.imagenArchivo) : null}
        />

        <section className="tarjeta">
          <h3 className="titulo-tarjeta">Para las piezas</h3>
          <NombrePiezas productoId={p.id} actual={p.nombrePiezas} sugerido={p.nombreSugerido} />
          <InterruptorPiezas productoId={p.id} excluido={p.excluirDePiezas} />

          <h3 className="titulo-tarjeta">Datos del ERP</h3>
          <dl className="datos">
            <dt>Marca</dt>
            <dd>{p.marcaId && marca ? <Link href={`/catalogo?marca=${p.marcaId}`}>{marca}</Link> : <span className="texto-suave">Sin marca</span>}</dd>
            <dt>Categoría</dt>
            <dd>
              {p.categoria ? <Link href={`/catalogo?categoria=${encodeURIComponent(p.categoria)}`}>{p.categoria}</Link> : <span className="texto-suave">Sin categoría</span>}
              {p.categoria && p.subcategoria && <> › <Link href={`/catalogo?categoria=${encodeURIComponent(p.categoria)}&subcategoria=${encodeURIComponent(p.subcategoria)}`}>{p.subcategoria}</Link></>}
            </dd>
            <dt>Tipo</dt>
            <dd>{p.tipo === 'granel' ? 'A granel (por kilo)' : 'Envasado'} · IVA {numero(erp.iva)}%</dd>
            <dt>Código</dt>
            <dd>{erp.codigo || <span className="texto-suave">—</span>}</dd>
            <dt>Código de barras</dt>
            <dd>{erp.codigoBarras || <span className="texto-suave">—</span>}{erp.dun && <div className="texto-chico">DUN {erp.dun}</div>}</dd>
            <dt>Nombre en el ERP</dt>
            <dd>{p.nombreErp}</dd>
            {descripcionUtil && <><dt>Descripción</dt><dd>{descripcionUtil}</dd></>}
            <dt>ID</dt>
            <dd>{p.id} · en la plataforma desde {cuando(p.creadoEn)}</dd>
          </dl>
        </section>
      </div>

      <section className="tarjeta">
        <h3 className="titulo-tarjeta">Precios</h3>
        {!hayPrecios ? (
          <p className="texto-suave">El ERP no tiene precios cargados para este producto.</p>
        ) : (
          <div className="tabla-marco">
            <table className="tabla">
              <thead>
                <tr>
                  {erp.presentaciones.length > 0 && <th>Fraccionado</th>}
                  <th>Lista</th><th className="num">Precio</th><th className="num">Bulto</th><th className="num">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {erp.precios.length > 0 && <FilasPrecios precios={erp.precios} nombreLista={nombreLista} fraccionado={erp.presentaciones.length ? 'Por kilo' : undefined} />}
                {erp.presentaciones.map((pr) => <FilasPrecios key={pr.id} precios={pr.precios} nombreLista={nombreLista} fraccionado={pr.tamano} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h3 className="titulo-tarjeta">Historial de cambios</h3>
        {historial.length === 0 ? (
          <p className="texto-suave">Sin cambios desde que se importó.</p>
        ) : (
          <div className="tabla-marco">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Qué cambió</th><th>Antes</th><th>Después</th></tr></thead>
              <tbody>
                {historial.map(({ c, fecha }) => {
                  const [antes, despues] = c.tipo === 'datos' ? soloDistintos(c.antes, c.despues) : [c.antes, c.despues]
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/catalogo/sincronizaciones/${c.sincronizacionId}`}>{fechaHora(fecha)}</Link></td>
                      <td><span className={`chip chip-cambio-${c.tipo}`}>{NOMBRE_CAMBIO[c.tipo] ?? c.tipo}</span></td>
                      <td>{['alta', 'baja', 'reactivado'].includes(c.tipo) ? <span className="texto-suave">—</span> : <ValorCambio tipo={c.tipo} valor={antes} marcasPorId={marcasPorId} />}</td>
                      <td>{['baja', 'reactivado'].includes(c.tipo) ? <span className="texto-suave">—</span> : <ValorCambio tipo={c.tipo} valor={despues} marcasPorId={marcasPorId} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="texto-chico"><Icono nombre="info" tamano={14} /> Los datos del ERP se actualizan con «Sincronizar ahora». Tu foto, el nombre para piezas y si va en piezas no se pisan nunca.</p>
    </>
  )
}
