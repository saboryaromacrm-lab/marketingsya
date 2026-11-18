'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { nombresCortos, pesosPromo, precioPromo, textoOferta, tituloComun } from '@/lib/promos/calculo'
import { estadoPromo, textoVigencia } from '@/lib/promos/fechas'
import type { DatosEditor, FilaEditor, InfoProducto } from '@/lib/promos/editor'
import { borrarPromo, duplicarPromo, exportarPromo, filasParaSumar, guardarPromo } from '../acciones'

type PlacaVista = { formato: 'historia' | 'feed' | 'uno'; pagina: number; paginas: number; ruta: string }
type Exportacion = { id: number; estado: string; zip: string | null } | null
type Props = {
  id: number
  inicial: DatosEditor
  infoInicial: Record<number, InfoProducto>
  placasIniciales: PlacaVista[]
  listas: { id: number; nombre: string; modalidad: string }[]
  exportacionInicial: Exportacion
  elegidos: number
  erpFaltantes: number
}

const FORMATOS = [
  { clave: 'historia', texto: 'Historias y WhatsApp', medida: '1080×1920' },
  { clave: 'feed', texto: 'Feed de Instagram', medida: '1080×1350' },
  { clave: 'uno', texto: 'Uno por producto', medida: '1080×1350' },
] as const
const NOMBRE_FORMATO = { historia: 'Historia', feed: 'Feed', uno: 'Producto' }
const TIPO = { producto: 'PRODUCTO', variantes: 'VARIANTES', grupo: 'GRUPO' }

// '' → null (sin valor); algo que no es número → undefined (no se toma el cambio)
const numeroONull = (v: string) => {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function EditorPromo({ id, inicial, infoInicial, placasIniciales, listas, exportacionInicial, elegidos, erpFaltantes }: Props) {
  const [datos, setDatos] = useState(inicial)
  const [info, setInfo] = useState(infoInicial)
  const [placas, setPlacas] = useState(placasIniciales)
  const [elegida, setElegida] = useState(0)
  const [version, setVersion] = useState(0)
  const [estado, setEstado] = useState<'guardado' | 'cambios' | 'guardando' | { error: string }>('guardado')
  const [quedanElegidos, setQuedanElegidos] = useState(elegidos)
  const [quedanErp, setQuedanErp] = useState(erpFaltantes)
  const [sumando, empezarSumar] = useTransition()
  const [yendo, empezarIr] = useTransition()

  // ---------- guardado automático (cada cambio, 0,7 s después de dejar de tipear) ----------
  const ultimo = useRef(inicial)
  const guardadoRef = useRef(inicial)
  const enCurso = useRef<Promise<void> | null>(null)
  const guardar = useCallback(async () => {
    const enviar = ultimo.current
    setEstado('guardando')
    const r = await guardarPromo(id, enviar)
    if ('error' in r) return setEstado({ error: r.error })
    guardadoRef.current = enviar
    setPlacas(r.placas)
    setVersion((v) => v + 1)
    setEstado(ultimo.current === enviar ? 'guardado' : 'cambios')
  }, [id])
  const primera = useRef(true)
  useEffect(() => {
    ultimo.current = datos
    if (primera.current) { primera.current = false; return }
    setEstado('cambios')
    const t = setTimeout(() => { enCurso.current = guardar() }, 700)
    return () => clearTimeout(t)
  }, [datos, guardar])

  /** Antes de exportar o salir: que lo último esté guardado. */
  async function guardarYa() {
    await enCurso.current
    if (ultimo.current !== guardadoRef.current) await guardar()
  }

  const cambiar = (parcial: Partial<DatosEditor>) => setDatos((d) => ({ ...d, ...parcial }))
  const cambiarFila = (i: number, parcial: Partial<FilaEditor>) => setDatos((d) => ({ ...d, filas: d.filas.map((f, k) => (k === i ? { ...f, ...parcial } : f)) }))
  const setFilas = (fn: (filas: FilaEditor[]) => FilaEditor[]) => setDatos((d) => ({ ...d, filas: fn(d.filas) }))

  // ---------- operaciones sobre las filas ----------
  const mover = (i: number, a: number) => setFilas((fs) => {
    if (a < 0 || a >= fs.length || a === i) return fs
    const copia = [...fs]
    const [f] = copia.splice(i, 1)
    copia.splice(a, 0, f)
    return copia
  })
  const juntar = (i: number, tipo: 'grupo' | 'variantes') => setFilas((fs) => {
    const a = fs[i], b = fs[i + 1]
    if (!b || a.origen === 'erp' || b.origen === 'erp') return fs
    return [...fs.slice(0, i), { ...a, tipo, titulo: null, productos: [...a.productos, ...b.productos] }, ...fs.slice(i + 2)]
  })
  const separar = (i: number) => setFilas((fs) => [
    ...fs.slice(0, i),
    ...fs[i].productos.map((p): FilaEditor => ({ ...fs[i], tipo: 'producto', titulo: null, productos: [p] })),
    ...fs.slice(i + 1),
  ])
  const quitarFila = (i: number) => setFilas((fs) => fs.filter((_, k) => k !== i))
  const quitarProducto = (i: number, pid: number) => setFilas((fs) => fs.map((f, k) => {
    if (k !== i) return f
    const productos = f.productos.filter((p) => p.id !== pid)
    return { ...f, productos, tipo: productos.length === 1 ? 'producto' : f.tipo }
  }))
  const cambiarItem = (i: number, pid: number, parcial: { nombre?: string | null; tam?: string | null; presentacion?: string | null }) =>
    setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, productos: f.productos.map((p) => (p.id === pid ? { ...p, ...parcial } : p)) } : f)))

  function sumar(origen: 'seleccion' | 'erp') {
    empezarSumar(async () => {
      const r = await filasParaSumar(origen, datos.filas.flatMap((f) => f.productos.map((p) => p.id)))
      setInfo((x) => ({ ...x, ...r.info }))
      setFilas((fs) => [...fs, ...r.filas])
      if (origen === 'seleccion') setQuedanElegidos(0)
      else setQuedanErp(0)
    })
  }

  // ---------- arrastrar para ordenar ----------
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  const placa = placas[Math.min(elegida, placas.length - 1)]
  const totalProductos = datos.filas.reduce((n, f) => n + f.productos.length, 0)
  const estadoVig = estadoPromo(datos.desde, datos.hasta)
  const lista = listas.find((l) => l.id === datos.listaId)

  return (
    <div className="contenido">
      <Cabecera
        titulo={`${datos.titulo || 'PROMOCIONES'} · ${textoVigencia(datos.desde, datos.hasta).toLowerCase()}`}
        subtitulo={`${datos.filas.length} ${datos.filas.length === 1 ? 'fila' : 'filas'} · ${totalProductos} ${totalProductos === 1 ? 'producto' : 'productos'} · ${estadoVig === 'vigente' ? 'vigente' : estadoVig === 'vencida' ? 'vencida' : 'por empezar'} · solo diseño: no cambia precios en el ERP`}
        miga={[{ texto: 'Promos', href: '/promos' }, { texto: `N.º ${id}` }]}
        acciones={
          <>
            <EstadoGuardado estado={estado} />
            <button className="btn" disabled={yendo} onClick={() => empezarIr(async () => { await guardarYa(); await duplicarPromo(id) })}><Icono nombre="content_copy" />Duplicar</button>
            <Exportar id={id} inicial={exportacionInicial} antes={guardarYa} hayPlacas={placas.length > 0} />
          </>
        }
      />

      <div className="editor-promo">
        {/* ---------- ajustes ---------- */}
        <section className="tarjeta editor-ajustes" aria-label="Ajustes de la promo">
          <label className="campo">
            <span className="campo-rotulo">Título</span>
            <input className="input" value={datos.titulo} maxLength={24} onChange={(e) => cambiar({ titulo: e.target.value.toUpperCase() })} placeholder="PROMOCIONES" />
          </label>
          <div className="campo">
            <span className="rotulo-columna">Vigencia</span>
            <div className="fila-fechas">
              <input className="input" type="date" aria-label="Desde" value={datos.desde} onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} />
              <input className="input" type="date" aria-label="Hasta" value={datos.hasta} min={datos.desde} onChange={(e) => e.target.value && cambiar({ hasta: e.target.value })} />
            </div>
          </div>
          <div className="campo">
            <span className="rotulo-columna">Formatos</span>
            {FORMATOS.map((f) => (
              <label key={f.clave} className="opcion-formato">
                <input type="checkbox" checked={datos.formatos[f.clave]} onChange={(e) => cambiar({ formatos: { ...datos.formatos, [f.clave]: e.target.checked } })} />
                <span>{f.texto}</span>
                <small>{f.medida}</small>
              </label>
            ))}
          </div>
          <div className="campo">
            <span className="rotulo-columna">Diseño</span>
            <div className="opciones-diseno">
              <button className={`btn btn-chico ${datos.diseno === '1' ? 'btn-pri' : ''}`} aria-pressed={datos.diseno === '1'} onClick={() => cambiar({ diseno: '1' })}>1 · Logo en círculo</button>
              <button className={`btn btn-chico ${datos.diseno === '2' ? 'btn-pri' : ''}`} aria-pressed={datos.diseno === '2'} onClick={() => cambiar({ diseno: '2' })}>2 · Cinta verde</button>
              <button className="btn btn-chico" onClick={() => cambiar({ diseno: datos.diseno === '1' ? '2' : '1' })} title="Cambia al otro diseño"><Icono nombre="casino" tamano={16} />Sorprendeme</button>
            </div>
          </div>
          <label className="campo">
            <span className="rotulo-columna">Precios de</span>
            <select className="input" value={datos.listaId} onChange={(e) => cambiar({ listaId: Number(e.target.value) })}>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </label>
          <p className="texto-chico">El precio promo sale del precio {lista?.nombre.toLowerCase() ?? ''} menos el descuento, con centavos. Contacto en todas las placas: tiendaonline.saboryaroma.com · WhatsApp 370 462-1563 · @saboryaroma__</p>
          <button className="enlace texto-chico borrar-promo" disabled={yendo} onClick={() => { if (confirm('¿Borrar esta promo? No se puede deshacer.')) empezarIr(() => borrarPromo(id)) }}>Borrar promo</button>
        </section>

        {/* ---------- vista previa ---------- */}
        <section className="editor-vista" aria-label="Vista previa">
          {placa ? (
            <>
              <VistaPlaca ruta={`${placa.ruta}&v=${version}`} formato={placa.formato} />
              <div className="tira-placas" role="tablist">
                {placas.map((p, i) => (
                  <button key={p.ruta} role="tab" aria-selected={p === placa} className={`tira-placa ${p === placa ? 'tira-placa-activa' : ''}`} onClick={() => setElegida(i)}>
                    <MiniPlaca ruta={`${p.ruta}&v=${version}`} formato={p.formato} />
                    <span>{NOMBRE_FORMATO[p.formato]}{p.paginas > 1 ? ` ${p.pagina}/${p.paginas}` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="vacio vacio-chico">
              <Icono nombre="image_not_supported" tamano={32} />
              <p><b>No hay placas para mostrar.</b></p>
              <p>{datos.filas.length ? 'Elegí al menos un formato.' : 'Sumá productos desde el catálogo.'}</p>
            </div>
          )}
        </section>

        {/* ---------- filas ---------- */}
        <section className="tarjeta editor-filas" aria-label="Filas de la promo">
          <span className="rotulo-columna">Filas (arrastrá para ordenar)</span>
          {datos.filas.map((f, i) => (
            <TarjetaFila
              key={`${i}-${f.productos.map((p) => p.id).join('-')}`}
              fila={f}
              i={i}
              total={datos.filas.length}
              info={info}
              listaId={datos.listaId}
              arrastrable
              resaltada={sobre === i && arrastrando !== null && arrastrando !== i}
              onDragStart={() => setArrastrando(i)}
              onDragOver={() => setSobre(i)}
              onDrop={() => { if (arrastrando !== null) mover(arrastrando, i); setArrastrando(null); setSobre(null) }}
              onDragEnd={() => { setArrastrando(null); setSobre(null) }}
              cambiar={(p) => cambiarFila(i, p)}
              cambiarItem={(pid, p) => cambiarItem(i, pid, p)}
              quitarProducto={(pid) => quitarProducto(i, pid)}
              acciones={{
                subir: () => mover(i, i - 1),
                bajar: () => mover(i, i + 1),
                grupo: datos.filas[i + 1] && f.origen !== 'erp' && datos.filas[i + 1].origen !== 'erp' ? () => juntar(i, 'grupo') : null,
                variantes: datos.filas[i + 1] && f.origen !== 'erp' && datos.filas[i + 1].origen !== 'erp' ? () => juntar(i, 'variantes') : null,
                separar: f.productos.length > 1 ? () => separar(i) : null,
                quitar: () => quitarFila(i),
              }}
            />
          ))}
          {!datos.filas.length && <p className="texto-suave">Todavía no hay productos en esta promo.</p>}
          <div className="sumar-filas">
            <button className="btn btn-chico" disabled={sumando || !quedanElegidos} onClick={() => sumar('seleccion')} title={quedanElegidos ? '' : 'Elegí productos con las casillas del catálogo'}>
              <Icono nombre="playlist_add" tamano={16} />Sumar los elegidos del catálogo{quedanElegidos ? ` (${quedanElegidos})` : ''}
            </button>
            {quedanErp > 0 && (
              <button className="btn btn-chico" disabled={sumando} onClick={() => sumar('erp')}>
                <Icono nombre="sync" tamano={16} />Sumar promos del ERP ({quedanErp})
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function EstadoGuardado({ estado }: { estado: 'guardado' | 'cambios' | 'guardando' | { error: string } }) {
  if (typeof estado === 'object') return <span className="texto-error estado-guardado" role="alert">{estado.error}</span>
  return (
    <span className="texto-chico estado-guardado" role="status">
      <Icono nombre={estado === 'guardado' ? 'cloud_done' : 'cloud_upload'} tamano={16} />
      {estado === 'guardado' ? 'Guardado' : 'Guardando…'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Vista previa: la misma página que abre el motor, achicada para que entre.
// ---------------------------------------------------------------------------
const ALTO_FORMATO = { historia: 1920, feed: 1350, uno: 1350 }

function VistaPlaca({ ruta, formato }: { ruta: string; formato: PlacaVista['formato'] }) {
  const marco = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.35)
  useLayoutEffect(() => {
    const el = marco.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setEscala(e.contentRect.width / 1080))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  // Se cambia de placa sin parpadeo: la nueva se carga atrás y aparece cuando está lista
  const [visible, setVisible] = useState(ruta)
  const alto = ALTO_FORMATO[formato]
  return (
    <div className={`vista-placa vista-${formato}`} ref={marco} style={{ aspectRatio: `1080 / ${alto}` }}>
      {[...new Set([visible, ruta])].map((r) => (
        <iframe
          key={r}
          src={r}
          title="Vista previa de la placa"
          className={r === ruta ? 'vista-actual' : 'vista-anterior'}
          style={{ width: 1080, height: alto, transform: `scale(${escala})` }}
          onLoad={() => r === ruta && setVisible(r)}
          tabIndex={-1}
        />
      ))}
    </div>
  )
}

function MiniPlaca({ ruta, formato }: { ruta: string; formato: PlacaVista['formato'] }) {
  const alto = ALTO_FORMATO[formato]
  const ancho = 72
  return (
    <span className="mini-placa" style={{ width: ancho, height: (ancho * alto) / 1080 }}>
      <iframe src={ruta} title="" loading="lazy" tabIndex={-1} style={{ width: 1080, height: alto, transform: `scale(${ancho / 1080})` }} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Una fila de la promo
// ---------------------------------------------------------------------------
type Acciones = { subir: () => void; bajar: () => void; grupo: (() => void) | null; variantes: (() => void) | null; separar: (() => void) | null; quitar: () => void }

function TarjetaFila(p: {
  fila: FilaEditor; i: number; total: number; info: Record<number, InfoProducto>; listaId: number
  arrastrable: boolean; resaltada: boolean
  onDragStart: () => void; onDragOver: () => void; onDrop: () => void; onDragEnd: () => void
  cambiar: (x: Partial<FilaEditor>) => void
  cambiarItem: (pid: number, x: { nombre?: string | null; tam?: string | null; presentacion?: string | null }) => void
  quitarProducto: (pid: number) => void
  acciones: Acciones
}) {
  const { fila: f, info, listaId, acciones } = p
  const [abierta, setAbierta] = useState(false)
  const [nombres, setNombres] = useState(false)
  const menu = useRef<HTMLDetailsElement>(null)
  const prods = f.productos.map((x) => info[x.id])
  const nombresProd = prods.map((x) => x?.nombre ?? 'Producto')
  const cortos = nombresCortos(nombresProd)
  const sugerido = f.tipo === 'producto' ? nombresProd[0] : tituloComun(nombresProd) || 'Promo'
  const erp = f.origen === 'erp'

  // Precio del primero (y rango si cambian entre productos)
  const precios = f.productos.map((x) => {
    const base = info[x.id]?.bases[String(listaId)]?.[x.presentacion ?? ''] ?? null
    return { base, promo: precioPromo(base, f) }
  })
  const conPrecio = precios.filter((x) => x.promo != null)
  const sinPrecio = precios.length - conPrecio.length
  const iguales = conPrecio.every((x) => x.promo === conPrecio[0]?.promo)

  const hacer = (fn: (() => void) | null) => () => { if (menu.current) menu.current.open = false; fn?.() }

  return (
    <article
      className={`fila-promo ${p.resaltada ? 'fila-promo-destino' : ''}`}
      draggable={p.arrastrable && !abierta}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; p.onDragStart() }}
      onDragOver={(e) => { e.preventDefault(); p.onDragOver() }}
      onDrop={(e) => { e.preventDefault(); p.onDrop() }}
      onDragEnd={p.onDragEnd}
    >
      <div className="fila-promo-cabeza">
        <Icono nombre="drag_indicator" className="asa" />
        <span className={`chip chip-tipo-${f.tipo}`}>{TIPO[f.tipo]}</span>
        {erp && <span className="chip chip-erp" title="Viene de la lista Promo del ERP: el precio es el del ERP">ERP</span>}
        {prods.some((x) => x && !x.foto) && <a className="chip chip-cambio-precio" href={`/catalogo/${f.productos.find((x) => !info[x.id]?.foto)?.id}`} target="_blank" rel="noreferrer" title="Sale con «Sin foto» en el flyer. Subile una en el catálogo.">SIN FOTO</a>}
        <input
          className="input input-titulo-fila"
          value={f.titulo ?? ''}
          placeholder={sugerido}
          maxLength={60}
          aria-label="Título en el flyer"
          onChange={(e) => p.cambiar({ titulo: e.target.value || null })}
        />
        <details className="menu-fila" ref={menu} onToggle={(e) => setAbierta((e.target as HTMLDetailsElement).open)}>
          <summary className="superior-boton" aria-label="Más opciones"><Icono nombre="more_vert" /></summary>
          <div className="menu-fila-opciones">
            <button disabled={p.i === 0} onClick={hacer(acciones.subir)}><Icono nombre="arrow_upward" tamano={16} />Subir</button>
            <button disabled={p.i === p.total - 1} onClick={hacer(acciones.bajar)}><Icono nombre="arrow_downward" tamano={16} />Bajar</button>
            <button disabled={!acciones.grupo} onClick={hacer(acciones.grupo)}><Icono nombre="view_module" tamano={16} />Juntar con la de abajo (grupo)</button>
            <button disabled={!acciones.variantes} onClick={hacer(acciones.variantes)}><Icono nombre="style" tamano={16} />Juntar con la de abajo (variantes)</button>
            <button disabled={!acciones.separar} onClick={hacer(acciones.separar)}><Icono nombre="call_split" tamano={16} />Separar en productos</button>
            <button onClick={hacer(acciones.quitar)} className="menu-peligro"><Icono nombre="delete" tamano={16} />Quitar fila</button>
          </div>
        </details>
      </div>

      <div className="fila-promo-fotos">
        {f.productos.map((x, k) => (
          <span key={x.id} className="miniatura" title={nombresProd[k]}>
            {prods[k]?.foto ? <img src={prods[k].foto!} alt="" /> : <Icono nombre="no_photography" tamano={16} />}
            {f.productos.length > 1 && (
              <button className="quitar-producto" onClick={() => p.quitarProducto(x.id)} aria-label={`Sacar ${nombresProd[k]}`}><Icono nombre="close" tamano={12} /></button>
            )}
          </span>
        ))}
      </div>
      {f.tipo === 'variantes' && <div className="texto-chico">Variantes: {cortos.map((c, k) => f.productos[k].nombre || c.nombre).join(' · ')}</div>}

      {erp ? (
        <div className="texto-chico">Promo cargada en el ERP: {textoOferta(f)}{f.cantidadMinima ? ` (${pesosPromo(f.precioFijo ?? 0)} c/u)` : ''}. El precio no se cambia acá.</div>
      ) : (
        <div className="fila-promo-regla">
          <label>Descuento <input className="input input-num" inputMode="decimal" value={f.descuento ?? ''} onChange={(e) => { const n = numeroONull(e.target.value); if (n !== undefined && (n ?? 0) <= 90) p.cambiar({ descuento: n }) }} aria-label="Descuento en %" /> %</label>
          <label>Llevando <input className="input input-num" inputMode="numeric" value={f.cantidadMinima ?? ''} placeholder="—" onChange={(e) => { const n = numeroONull(e.target.value); if (n !== undefined && (n == null || Number.isInteger(n))) p.cambiar({ cantidadMinima: n || null }) }} aria-label="Cantidad mínima" /> o más</label>
        </div>
      )}
      <div className="texto-chico fila-promo-precio">
        {conPrecio.length ? (
          <>
            {conPrecio[0].base != null && conPrecio[0].base !== conPrecio[0].promo && <>{pesosPromo(conPrecio[0].base)} → </>}
            <b>{pesosPromo(conPrecio[0].promo!)}</b> c/u
            {!iguales && ' (cambia según el producto)'}
          </>
        ) : 'Sin precio en esta lista'}
        {sinPrecio > 0 && conPrecio.length > 0 && <span className="falta"> · {sinPrecio} sin precio</span>}
        {' · etiqueta '}<b>{textoOferta(f)}</b>
      </div>

      <button className="enlace texto-chico" onClick={() => setNombres(!nombres)}>{nombres ? 'Ocultar nombres' : 'Cambiar nombres en el flyer'}</button>
      {nombres && (
        <div className="nombres-fila">
          {f.productos.map((x, k) => {
            const pr = prods[k]
            return (
              <div key={x.id} className="nombre-item">
                <input className="input" value={x.nombre ?? ''} placeholder={f.tipo === 'producto' ? (f.titulo || nombresProd[k]) : cortos[k].nombre} maxLength={40} aria-label="Nombre" onChange={(e) => p.cambiarItem(x.id, { nombre: e.target.value || null })} disabled={f.tipo === 'producto'} />
                {f.tipo !== 'producto' && <input className="input input-tam" value={x.tam ?? ''} placeholder={cortos[k].tam ?? 'medida'} maxLength={20} aria-label="Medida" onChange={(e) => p.cambiarItem(x.id, { tam: e.target.value || null })} />}
                {pr?.granel && pr.presentaciones.length > 0 && !erp && (
                  <select className="input input-tam" value={x.presentacion ?? ''} aria-label="Precio de" onChange={(e) => p.cambiarItem(x.id, { presentacion: e.target.value || null })}>
                    <option value="">Por kilo</option>
                    {pr.presentaciones.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
            )
          })}
          {f.tipo === 'producto' && <p className="texto-chico">En un producto solo, el nombre se cambia en el título de la fila.</p>}
        </div>
      )}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Exportar: arma los JPEG con el motor y deja el .zip para descargar
// ---------------------------------------------------------------------------
function Exportar({ id, inicial, antes, hayPlacas }: { id: number; inicial: Exportacion; antes: () => Promise<void>; hayPlacas: boolean }) {
  const [exp, setExp] = useState<{ id: number; estado: string; avance: number; zip: string | null; error?: string | null } | null>(inicial ? { ...inicial, avance: 100 } : null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const corriendo = pendiente || (exp ? ['en_cola', 'corriendo'].includes(exp.estado) : false)

  useEffect(() => {
    if (!exp || !['en_cola', 'corriendo'].includes(exp.estado)) return
    const t = setTimeout(async () => {
      const r = await fetch(`/api/exportaciones/${exp.id}`, { cache: 'no-store' }).catch(() => null)
      if (r?.ok) setExp(await r.json())
    }, 900)
    return () => clearTimeout(t)
  }, [exp])

  return (
    <>
      {exp?.estado === 'ok' && exp.zip && !corriendo && (
        <a className="btn" href={exp.zip} download><Icono nombre="download" />Descargar .zip</a>
      )}
      <button
        className="btn btn-pri"
        disabled={corriendo || !hayPlacas}
        onClick={() => empezar(async () => {
          setError(null)
          await antes()
          const r = await exportarPromo(id)
          if ('error' in r) setError(r.error)
          else setExp({ id: r.exportacionId, estado: 'en_cola', avance: 0, zip: null })
        })}
      >
        <Icono nombre={corriendo ? 'sync' : 'image'} className={corriendo ? 'girando' : ''} />
        {corriendo ? `Armando… ${exp?.avance ?? 0}%` : 'Exportar JPEG (.zip)'}
      </button>
      {(error || exp?.estado === 'error') && <span className="texto-error" role="alert">{error ?? `No se pudo exportar: ${exp?.error ?? 'error del motor'}`}</span>}
    </>
  )
}
