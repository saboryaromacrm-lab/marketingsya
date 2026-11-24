'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icono } from '@/components/Icono'
import type { ListaPiezas, OpcionesListaPiezas } from '@/lib/catalogo/lista-piezas'
import {
  filtrosDeTipo, filtrosPuestos, ORDENES, paginasVisibles, parametrosLista, POR_PAGINA_LISTA, textoStock, DIAS_NUEVOS, type FiltrosLista, type OrdenLista, type TipoPieza,
} from '@/lib/catalogo/lista-piezas-reglas'
import { accionListaPiezas, accionMarcarParaPieza, type ElegidoVista } from './acciones'
import { imagenMini } from '@/lib/miniaturas'

type Props = {
  tipo: TipoPieza
  filtrosIniciales: FiltrosLista
  inicial: ListaPiezas
  opciones: OpcionesListaPiezas
  // Los elegidos de arriba: marcan las casillas (si se sacan arriba, se destildan acá sin pedir la lista de nuevo)
  elegidosIds: number[]
  tope: number | null
  listaNombre: string
  avisoInicial: string | null
  // Después de marcar o desmarcar: los elegidos como quedaron (se muestran arriba sin recargar la página)
  alCambiar: (elegidos: ElegidoVista[]) => void
}

const pesos = (n: number) => `$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Cordoba' })

/** Marca con búsqueda adentro (son más de 200). */
function ElegirMarca({ valor, opciones, alCambiar }: { valor: FiltrosLista['marca']; opciones: OpcionesListaPiezas['marcas']; alCambiar: (v: FiltrosLista['marca']) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const actual = valor === 'sin' ? 'A granel / sin marca' : opciones.find((m) => m.id === valor)?.nombre ?? 'Todas'
  const texto = q.trim().toLowerCase()
  const lista = opciones.filter((m) => !texto || m.nombre.toLowerCase().includes(texto)).slice(0, 60)
  return (
    <div className="lp-marca" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false) }}>
      <button type="button" className="lp-sel" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}><Icono nombre="sell" tamano={16} />Marca: <b>{actual}</b><Icono nombre="expand_more" tamano={16} /></button>
      {abierto && (
        <div className="lp-marca-lista" role="listbox">
          <label className="filtro-busqueda"><Icono nombre="search" tamano={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca" aria-label="Buscar marca" /></label>
          <button type="button" className={valor == null ? 'lp-marca-activa' : ''} onClick={() => { alCambiar(null); setAbierto(false) }}>Todas</button>
          <button type="button" className={valor === 'sin' ? 'lp-marca-activa' : ''} onClick={() => { alCambiar('sin'); setAbierto(false) }}>A granel / sin marca</button>
          {lista.map((m) => <button key={m.id} type="button" className={valor === m.id ? 'lp-marca-activa' : ''} onClick={() => { alCambiar(m.id); setAbierto(false) }}>{m.nombre}<small>{m.n}</small></button>)}
          {!lista.length && <span className="texto-chico">No hay marcas con ese nombre.</span>}
        </div>
      )}
    </div>
  )
}

export function ListaProductos({ tipo, filtrosIniciales, inicial, opciones, elegidosIds, tope, listaNombre, alCambiar, avisoInicial }: Props) {
  const [f, setF] = useState(filtrosIniciales)
  const [res, setRes] = useState(inicial)
  const [cargando, setCargando] = useState(false)
  const [abiertos, setAbiertos] = useState(false)
  const [aviso, setAviso] = useState<string | null>(avisoInicial)
  const [error, setError] = useState<string | null>(null)
  const [marcados, setMarcados] = useState<Record<number, boolean>>({})
  const [, empezar] = useTransition()
  const primera = useRef(true)
  const tipoPrevio = useRef(tipo)
  // Los nuevos se ponen solos en Lanzamiento: si no hay, se sacan y se avisa (una sola vez)
  const nuevosAutomatico = useRef(filtrosIniciales.nuevos && (tipo === 'lanzamiento' || tipo === 'fecha'))

  // Al cambiar lo que se comunica, la lista vuelve a los filtros de entrada de ese tipo
  useEffect(() => {
    if (tipoPrevio.current === tipo) return
    tipoPrevio.current = tipo
    nuevosAutomatico.current = tipo === 'lanzamiento' || tipo === 'fecha'
    setAviso(null)
    setF(filtrosDeTipo(tipo))
  }, [tipo])

  // Cada cambio de filtros: se pide la página y se guarda en la dirección (si salís y volvés, siguen puestos)
  useEffect(() => {
    const q = new URLSearchParams(parametrosLista(f, tipo)).toString()
    window.history.replaceState(window.history.state, '', `/creacion?${q}`)
    if (primera.current) { primera.current = false; return }
    let vigente = true
    setCargando(true)
    const t = setTimeout(async () => {
      const r = await accionListaPiezas(f)
      if (!vigente) return
      setCargando(false)
      if (f.nuevos && r.total === 0 && nuevosAutomatico.current) {
        nuevosAutomatico.current = false
        setAviso(`No hay productos nuevos en los últimos ${DIAS_NUEVOS} días: te mostramos los de mayor stock.`)
        setF((x) => ({ ...x, nuevos: false, orden: 'stock', pagina: 1 }))
        return
      }
      setRes(r)
      setMarcados({})
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [f, tipo])

  const cambiar = (c: Partial<FiltrosLista>) => { if ('nuevos' in c) nuevosAutomatico.current = false; setF((x) => ({ ...x, pagina: 1, ...c })) }
  const elegidos = elegidosIds.length
  const elegido = (id: number) => marcados[id] ?? elegidosIds.includes(id)
  const lleno = tope != null && elegidos >= tope

  function alternar(id: number, ahora: boolean) {
    setError(null)
    if (!ahora && lleno) return setError(`Ya elegiste ${tope}: es lo que entra en esta pieza. Sacá uno para sumar otro.`)
    setMarcados((m) => ({ ...m, [id]: !ahora }))
    empezar(async () => {
      const r = await accionMarcarParaPieza(id, !ahora, tipo)
      if ('error' in r) { setError(r.error); setMarcados((m) => ({ ...m, [id]: ahora })); return }
      alCambiar(r.elegidos)
      setMarcados((m) => { const x = { ...m }; delete x[id]; return x })
    })
  }

  const desde = (res.pagina - 1) * POR_PAGINA_LISTA + 1
  const hasta = Math.min(res.total, res.pagina * POR_PAGINA_LISTA)
  const todoSinStock = res.productos.length > 0 && res.productos.every((p) => !p.stock) && !f.conStock
  const puestos = filtrosPuestos(f)

  return (
    <div className="lp" aria-busy={cargando}>
      <div className="lp-cab">
        <b>Elegí de la lista{tope != null && <span className="lp-cont"> · {elegidos} de {tope} elegidos</span>}</b>
        <span className="texto-chico">{opciones.stockAl ? `Stock al ${fechaHora(opciones.stockAl)} (última sincronización)` : 'Sin sincronizar todavía'} · precios {listaNombre}</span>
      </div>
      {aviso && <div className="aviso aviso-ambar"><Icono nombre="info" />{aviso}</div>}
      {!aviso && f.nuevos && (tipo === 'lanzamiento' || tipo === 'fecha') && (
        <div className="lp-aviso"><Icono nombre="fiber_new" tamano={20} /><span>Te mostramos los <b>productos nuevos</b> (últimos {DIAS_NUEVOS} días). Sacá el filtro «Nuevos» para ver todo.</span></div>
      )}

      <div className="lp-filtros">
        <label className="filtro-busqueda"><Icono nombre="search" /><input value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder="Buscar por nombre, marca o código" aria-label="Buscar productos" />{cargando && <Icono nombre="sync" className="girando" tamano={16} />}</label>
        <button type="button" className="btn btn-chico lp-boton-filtros" aria-expanded={abiertos} onClick={() => setAbiertos((x) => !x)}><Icono nombre="tune" tamano={16} />Filtros{puestos ? ` (${puestos})` : ''}</button>
      </div>
      <div className={`lp-mas ${abiertos ? 'lp-mas-abierto' : ''}`}>
        <div className="lp-filtros">
          <ElegirMarca valor={f.marca} opciones={opciones.marcas} alCambiar={(marca) => cambiar({ marca })} />
          <label className="lp-sel"><Icono nombre="category" tamano={16} /><select aria-label="Categoría" value={f.categoria ?? ''} onChange={(e) => cambiar({ categoria: e.target.value || null })}><option value="">Categoría: todas</option>{opciones.categorias.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre} ({c.n})</option>)}</select></label>
          <label className="lp-sel"><Icono nombre="store" tamano={16} /><select aria-label="Sucursal" value={f.sucursal ?? ''} onChange={(e) => cambiar({ sucursal: e.target.value ? Number(e.target.value) : null })}><option value="">Las {opciones.sucursales.length} sucursales</option>{opciones.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
          <label className="lp-sel"><Icono nombre="sort" tamano={16} /><select aria-label="Orden" value={f.orden} onChange={(e) => cambiar({ orden: e.target.value as OrdenLista })}>{(Object.keys(ORDENES) as OrdenLista[]).map((o) => <option key={o} value={o}>Orden: {ORDENES[o]}</option>)}</select></label>
        </div>
        <div className="lp-filtros">
          <button type="button" className={`lp-chip ${f.nuevos ? 'lp-chip-activo' : ''}`} aria-pressed={f.nuevos} onClick={() => cambiar({ nuevos: !f.nuevos })}><Icono nombre="fiber_new" tamano={16} />Nuevos{opciones.nuevos ? ` (${opciones.nuevos})` : ''}</button>
          <button type="button" className={`lp-chip ${f.bajaron ? 'lp-chip-activo' : ''}`} aria-pressed={f.bajaron} onClick={() => cambiar({ bajaron: !f.bajaron })}><Icono nombre="trending_down" tamano={16} />Bajaron de precio</button>
          <button type="button" className={`lp-chip ${f.conStock ? 'lp-chip-activo' : ''}`} aria-pressed={f.conStock} onClick={() => cambiar({ conStock: !f.conStock })}><Icono nombre="inventory" tamano={16} />Solo con stock</button>
          <div className="segmentado" role="radiogroup" aria-label="Tipo de producto">
            {([['todos', 'Todos'], ['entero', 'Envasados'], ['granel', 'A granel']] as const).map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={f.tipo === k} className={f.tipo === k ? 'segmentado-activo' : ''} onClick={() => cambiar({ tipo: k })}>{t}</button>)}
          </div>
          {puestos > 0 && <button type="button" className="enlace texto-chico" onClick={() => { nuevosAutomatico.current = false; setAviso(null); setF({ ...filtrosDeTipo('promo'), q: f.q }) }}>Sacar los filtros</button>}
        </div>
      </div>

      {res.aproximada && res.total > 0 && <span className="texto-chico">No hay nada escrito así: te mostramos los parecidos.</span>}
      {error && <span className="texto-error" role="alert">{error}</span>}
      {res.total === 0 ? (
        <div className="vacio">No hay productos con esos filtros.</div>
      ) : (
        <div className={`lp-grilla ${cargando ? 'lp-cargando' : ''}`}>
          {res.productos.map((p) => {
            const si = elegido(p.id)
            const bloqueado = !si && lleno
            return (
              <label key={p.id} className={`lp-p ${si ? 'lp-p-elegido' : ''} ${bloqueado ? 'lp-p-bloqueado' : ''}`} title={bloqueado ? `Ya elegiste ${tope}` : undefined}>
                <input type="checkbox" checked={si} disabled={bloqueado} onChange={() => alternar(p.id, si)} aria-label={`Elegir ${p.nombre}`} />
                {p.nuevo && <span className="lp-nuevo">NUEVO</span>}
                {p.foto && <img {...imagenMini(p.foto, 150)} alt="" loading="lazy" />}
                <span className="lp-marca-texto">{p.marca || (p.granel ? 'A granel' : '')}</span>
                <b>{p.nombre}</b>
                <span className="lp-pie-producto">
                  <span className="lp-precio">{p.precio != null ? <>{pesos(p.precio)}{p.granel && <small> {p.presentacion ? `x${p.presentacion}` : 'el kg'}</small>}</> : <small>sin precio</small>}</span>
                  <span className={`lp-stock ${p.stock > 0 ? '' : 'lp-stock-cero'}`}>{textoStock(p.stock, p.granel)}</span>
                </span>
              </label>
            )
          })}
        </div>
      )}
      {todoSinStock && <span className="texto-chico texto-aviso">¿Todo sin stock? Sincronizá el catálogo (Catálogo › Sincronizar) para traer el stock del ERP.</span>}

      <div className="lp-pie">
        <span>
          {res.total > 0 && <>Mostrando {desde}–{hasta} de {res.total.toLocaleString('es-AR')}</>}
          {res.sinFoto > 0 && <> · hay {res.sinFoto.toLocaleString('es-AR')} sin foto que no se pueden usar: <Link prefetch={false} href="/catalogo?foto=sin">subí la foto desde el Catálogo</Link></>}
        </span>
        {res.paginas > 1 && (
          <nav className="lp-paginas" aria-label="Páginas">
            <button type="button" disabled={res.pagina <= 1} onClick={() => setF((x) => ({ ...x, pagina: res.pagina - 1 }))} aria-label="Página anterior"><Icono nombre="chevron_left" tamano={18} /></button>
            {paginasVisibles(res.pagina, res.paginas).map((n, i) => n == null ? <span key={`s${i}`}>…</span> : <button key={n} type="button" className={n === res.pagina ? 'lp-pagina-activa' : ''} aria-current={n === res.pagina ? 'page' : undefined} onClick={() => setF((x) => ({ ...x, pagina: n }))}>{n}</button>)}
            <button type="button" disabled={res.pagina >= res.paginas} onClick={() => setF((x) => ({ ...x, pagina: res.pagina + 1 }))} aria-label="Página siguiente"><Icono nombre="chevron_right" tamano={18} /></button>
          </nav>
        )}
      </div>
    </div>
  )
}
