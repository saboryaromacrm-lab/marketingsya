import Link from 'next/link'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import { FiltrosCatalogo } from '@/components/catalogo/FiltrosCatalogo'
import { AccionMasiva } from '@/components/catalogo/AccionMasiva'
import { CasillaPagina, CasillaProducto, SeleccionCatalogo } from '@/components/catalogo/Seleccion'
import { productosElegidos } from '@/lib/seleccion'
import { resumenCatalogo } from '@/lib/catalogo/consultas'
import { leerFiltros, POR_PAGINA, urlConFiltros, type Filtros, type Pestana } from '@/lib/catalogo/filtros'
import { ultimaSincronizacionBuena } from '@/lib/catalogo/iniciar'
import { buscarProductos, opcionesDeFiltros, type FilaProducto, type OpcionesDeFiltros } from '@/lib/catalogo/listado'
import { urlMedia } from '@/lib/media'
import { cuando, numero, pesos, plural } from '@/lib/formato'

const PESTANAS: { clave: Pestana; texto: string }[] = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'envasados', texto: 'Envasados' },
  { clave: 'granel', texto: 'A granel' },
  { clave: 'baja', texto: 'Dados de baja' },
]

// «x12» → «por unidad, bulto de 12»; granel → «1 kg»
function aclaracion(p: { unidades: number; presentacion: string | null }) {
  if (p.presentacion) return p.presentacion
  if (p.unidades !== 1) return `por unidad · bulto de ${numero(p.unidades)}`
  return null
}

function Precio({ fila, f, listas }: { fila: FilaProducto; f: Filtros; listas: OpcionesDeFiltros['listas'] }) {
  const principal = fila.preciosLista[f.lista]
  const nombreLista = (id: number) => {
    const l = listas.find((x) => x.id === id)
    return l ? l.modalidad.toLowerCase() : `lista ${id}`
  }
  const otras = listas.filter((l) => l.id !== f.lista && fila.preciosLista[l.id])
  return (
    <>
      {principal ? <div className="precio">{pesos(principal.precio)}</div> : <div className="falta">Sin precio</div>}
      {principal && (
        <div className="texto-chico">
          {nombreLista(f.lista)}
          {aclaracion(principal) && ` · ${aclaracion(principal)}`}
        </div>
      )}
      {otras.map((l) => (
        <div key={l.id} className="texto-chico">
          {pesos(fila.preciosLista[l.id].precio)} {nombreLista(l.id)}
          {fila.preciosLista[l.id].unidades !== 1 && ` x${numero(fila.preciosLista[l.id].unidades)}`}
        </div>
      ))}
    </>
  )
}

// Chips con los filtros activos, cada uno con su ✕ para sacarlo
function FiltrosActivos({ f, opciones }: { f: Filtros; opciones: OpcionesDeFiltros }) {
  const chips: { texto: string; sin: Partial<Filtros> }[] = []
  if (f.q) chips.push({ texto: `«${f.q}»`, sin: { q: '' } })
  if (f.categoria) chips.push({ texto: f.categoria, sin: { categoria: null, subcategoria: null } })
  if (f.subcategoria) chips.push({ texto: f.subcategoria, sin: { subcategoria: null } })
  if (f.marca === 'sin') chips.push({ texto: 'Sin marca', sin: { marca: null } })
  else if (f.marca != null) chips.push({ texto: opciones.marcas.find((m) => m.id === f.marca)?.nombre ?? `Marca ${f.marca}`, sin: { marca: null } })
  if (f.etiqueta) chips.push({ texto: f.etiqueta, sin: { etiqueta: null } })
  if (f.foto) chips.push({ texto: f.foto === 'con' ? 'Con foto' : 'Sin foto', sin: { foto: null } })
  if (f.sinPrecio) chips.push({ texto: 'Sin precio en la lista', sin: { sinPrecio: false } })
  if (f.piezas) chips.push({ texto: f.piezas === 'si' ? 'Van en piezas' : 'No van en piezas', sin: { piezas: null } })
  if (!chips.length) return null
  return (
    <div className="filtros-activos">
      {chips.map((c) => (
        <Link prefetch={false} key={c.texto} href={urlConFiltros(f, c.sin)} className="chip chip-filtro" scroll={false}>
          {c.texto} <Icono nombre="close" tamano={14} />
        </Link>
      ))}
      {chips.length > 1 && <Link prefetch={false} href={urlConFiltros(f, { q: '', categoria: null, subcategoria: null, marca: null, etiqueta: null, foto: null, sinPrecio: false, piezas: null })} scroll={false}>Limpiar todo</Link>}
    </div>
  )
}

// Siempre al día al volver: lo que muestra cambia solo o desde otra pantalla (no se reusa lo visto, ver staleTimes en next.config)
export const unstable_dynamicStaleTime = 0

export default async function Catalogo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = leerFiltros(await searchParams)
  const [r, ultima, opciones, resultado, elegidos] = await Promise.all([resumenCatalogo(), ultimaSincronizacionBuena(), opcionesDeFiltros(), buscarProductos(f), productosElegidos()])

  if (!ultima || r.activos + r.deBaja === 0) {
    return (
      <div className="vacio">
        <Icono nombre="inventory_2" tamano={40} />
        <p><b>Todavía no hay productos.</b> Apretá «Sincronizar ahora» para traer el catálogo del ERP.</p>
        <p>La primera vez tarda unos minutos porque copia todas las fotos.</p>
      </div>
    )
  }

  const { filas, conteos, total, pagina, paginas, aproximada } = resultado
  const desde = (pagina - 1) * POR_PAGINA + 1
  const hasta = Math.min(pagina * POR_PAGINA, total)
  // Por qué no se puede elegir para una promo (null = se puede)
  const motivo = (p: FilaProducto) =>
    p.dadoDeBaja ? 'Está dado de baja' : p.excluirDePiezas ? 'Está marcado «no va en piezas»' : !p.foto ? 'No tiene foto: subile una para usarlo' : null
  const elegiblesPagina = filas.filter((p) => !motivo(p)).map((p) => p.id)

  return (
    <SeleccionCatalogo elegidos={elegidos}>
      <div>
        <h2 className="titulo-seccion">Productos</h2>
        <p className="texto-suave">
          {numero(r.activos)} productos · Última sincronización {cuando(ultima.terminadaEn ?? ultima.creadoEn)} · <Link prefetch={false} href="/catalogo/sincronizaciones">Ver historial</Link>
        </p>
      </div>

      {r.sinFoto > 0 && !f.foto && (
        <Aviso tono="ambar" dato={`${plural(r.sinFoto, 'producto no tiene', 'productos no tienen')} foto`} accion={<Link prefetch={false} className="btn btn-chico" href={urlConFiltros(f, { foto: 'sin', pestana: 'todos' })}>Ver {r.sinFoto === 1 ? 'cuál' : `los ${numero(r.sinFoto)}`}</Link>}>
          y no se pueden usar en piezas hasta que subas una (paso 4).
        </Aviso>
      )}
      {r.sinPrecio > 0 && !f.sinPrecio && (
        <Aviso tono="verde" dato={`${plural(r.sinPrecio, 'producto no tiene', 'productos no tienen')} precio minorista`} accion={<Link prefetch={false} className="btn btn-chico" href={urlConFiltros(f, { sinPrecio: true, lista: 3, pestana: 'todos' })}>Ver {r.sinPrecio === 1 ? 'cuál' : `los ${numero(r.sinPrecio)}`}</Link>}>
          en el ERP: aparecen igual, pero sin precio en las piezas.
        </Aviso>
      )}

      <FiltrosCatalogo filtros={f} opciones={opciones} />
      <FiltrosActivos f={f} opciones={opciones} />

      <nav className="pestanas" aria-label="Tipo de producto">
        {PESTANAS.map((p) => (
          <Link prefetch={false} key={p.clave} href={urlConFiltros(f, { pestana: p.clave })} className={f.pestana === p.clave ? 'pestana-activa' : ''} scroll={false}>
            {p.texto} ({numero(conteos[p.clave])})
          </Link>
        ))}
      </nav>

      {total > 0 && !aproximada && (f.q || f.categoria || f.marca != null || f.etiqueta || f.piezas) && (
        <AccionMasiva consulta={new URLSearchParams(urlConFiltros(f).split('?')[1] ?? '').toString()} total={total} soloExcluidos={f.piezas === 'no'} />
      )}

      {aproximada && total > 0 && (
        <Aviso tono="ambar" dato={`No hay nada con «${f.q}» escrito así.`}>Te mostramos los productos con nombres parecidos.</Aviso>
      )}

      {total === 0 ? (
        <div className="vacio vacio-chico">
          <Icono nombre="search_off" tamano={32} />
          <p><b>No hay productos con estos filtros.</b></p>
          <p><Link prefetch={false} href="/catalogo">Ver todo el catálogo</Link></p>
        </div>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla-productos tabla-clic">
            <thead>
              <tr><th className="celda-casilla"><CasillaPagina ids={elegiblesPagina} /></th><th>Foto</th><th>Producto</th><th>Marca</th><th>Categoría</th><th className="num">Precio</th></tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} className={`${p.dadoDeBaja ? 'fila-baja' : ''} ${p.excluirDePiezas ? 'fila-excluida' : ''}`}>
                  <td className="celda-casilla"><CasillaProducto id={p.id} nombre={p.nombre} motivo={motivo(p)} /></td>
                  <td className="celda-foto">
                    <div className={`miniatura ${p.foto ? '' : 'miniatura-vacia'}`}>
                      {p.foto ? <img src={urlMedia(p.foto)} alt="" loading="lazy" /> : <Icono nombre="no_photography" />}
                    </div>
                  </td>
                  <td className="celda-producto">
                    <Link prefetch={false} href={`/catalogo/${p.id}`} className="nombre-producto fila-enlace">{p.nombre}</Link>
                    <div className="chips">
                      {p.tipo === 'granel' && <span className="chip">A GRANEL</span>}
                      {p.estado !== 'activo' && <span className="chip chip-cambio-precio">{p.estado.toUpperCase()}</span>}
                      {p.dadoDeBaja && <span className="chip chip-error">DADO DE BAJA</span>}
                      {p.excluirDePiezas && <span className="chip chip-excluido">NO VA EN PIEZAS</span>}
                      {p.fotoPropia && <span className="chip chip-cambio-alta">FOTO PROPIA</span>}
                      {p.etiquetas.slice(0, 3).map((e) => <span key={e} className="chip">{e}</span>)}
                    </div>
                    <div className="texto-chico">
                      ID {p.id}
                      {p.fraccionados > 0 && ` · ${plural(p.fraccionados, 'fraccionado', 'fraccionados')}`}
                    </div>
                  </td>
                  <td className="celda-marca">{p.marca ?? <span className="texto-suave">Sin marca</span>}</td>
                  <td className="celda-categoria">
                    {p.categoria ?? <span className="texto-suave">Sin categoría</span>}
                    {p.subcategoria && <div className="texto-chico">{p.subcategoria}</div>}
                  </td>
                  <td className="num celda-precio"><Precio fila={p} f={f} listas={opciones.listas} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tabla-pie">
            <span>Mostrando {numero(desde)}–{numero(hasta)} de {numero(total)}</span>
            {paginas > 1 && (
              <span className="tabla-pie-botones">
                {pagina > 1 ? <Link prefetch={false} className="btn btn-chico" href={urlConFiltros(f, { pagina: pagina - 1 })}>Anterior</Link> : <span className="btn btn-chico" aria-disabled="true">Anterior</span>}
                <span className="pagina-actual">Página {numero(pagina)} de {numero(paginas)}</span>
                {pagina < paginas ? <Link prefetch={false} className="btn btn-chico" href={urlConFiltros(f, { pagina: pagina + 1 })}>Siguiente</Link> : <span className="btn btn-chico" aria-disabled="true">Siguiente</span>}
              </span>
            )}
          </div>
        </div>
      )}
    </SeleccionCatalogo>
  )
}
