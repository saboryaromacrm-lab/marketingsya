'use client'

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { nombresCortos, pesosPromo, precioPromo, textoOferta, textoPrecioErp, tituloComun } from '@/lib/promos/calculo'
import { estadoPromo, textoVigencia } from '@/lib/promos/fechas'
import type { BaseProducto, DatosEditor, FilaEditor, InfoProducto } from '@/lib/promos/editor'
import { borrarPromo, buscarParaPromo, duplicarPromo, exportarPromo, filasParaSumar, guardarPromo, infoParaSumar } from '../acciones'
import { Buscador, EstadoGuardado, Exportar, MiniPlaca, VistaPlaca, type Exportacion } from '@/components/piezas/Editor'
import { BotonIA, ContextoIA, type DisponibilidadIA } from '@/components/piezas/IA'
import { textoPosteo, type ContactoTexto } from '@/lib/carruseles/textos'
import { accionMejorarTexto } from '../../asesor/acciones'

type PlacaVista = { formato: 'historia' | 'feed' | 'uno'; pagina: number; paginas: number; ruta: string }
type Props = {
  id: number
  inicial: DatosEditor
  infoInicial: Record<number, InfoProducto>
  placasIniciales: PlacaVista[]
  listas: { id: number; nombre: string; modalidad: string }[]
  exportacionInicial: Exportacion
  elegidos: number
  erpFaltantes: number
  erpSinFoto: { id: number; nombre: string }[]
  descuentoInicial: number
  contacto: ContactoTexto
  hashtags: string[]
  ia: DisponibilidadIA
}

const FORMATOS = [
  { clave: 'historia', texto: 'Historias y WhatsApp', medida: '1080×1920' },
  { clave: 'feed', texto: 'Feed de Instagram', medida: '1080×1350' },
  { clave: 'uno', texto: 'Uno por producto', medida: '1080×1350' },
] as const
const NOMBRE_FORMATO = { historia: 'Historia', feed: 'Feed', uno: 'Producto' }
const TIPO = { producto: 'PRODUCTO', variantes: 'VARIANTES', grupo: 'GRUPO' }
const ESTADO = { vigente: { texto: 'VIGENTE', clase: 'chip-ok' }, 'por-empezar': { texto: 'POR EMPEZAR', clase: 'chip-en_cola' }, vencida: { texto: 'VENCIDA', clase: 'chip-excluido' } }

// '' → null (sin valor); algo que no es número → undefined (no se toma el cambio)
const numeroONull = (v: string) => {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

const baseDe = (info: Record<number, InfoProducto>, id: number, listaId: number, presentacion?: string | null): BaseProducto =>
  info[id]?.bases[String(listaId)]?.[presentacion ?? ''] ?? null

// ---------------------------------------------------------------------------
// Revisión antes de exportar: lo que impide exportar y lo que conviene mirar
// ---------------------------------------------------------------------------
type Revision = { bloquean: ReactNode[]; avisos: ReactNode[] }

function revisar(d: DatosEditor, info: Record<number, InfoProducto>, erpSinFoto: Props['erpSinFoto'], nombreLista: string): Revision {
  const bloquean: ReactNode[] = []
  const avisos: ReactNode[] = []
  if (d.filas.length && !d.formatos.historia && !d.formatos.feed && !d.formatos.uno) bloquean.push('Elegí al menos un formato.')
  const sinFoto = d.filas.flatMap((f) => f.productos).filter((p) => info[p.id] && !info[p.id].foto)
  for (const p of sinFoto) bloquean.push(<>«{info[p.id].nombre}» no tiene foto: sacalo de la promo o <Link href={`/catalogo/${p.id}`} target="_blank">subile una</Link>.</>)
  for (const p of erpSinFoto) avisos.push(<>«{p.nombre}» (promo del ERP) no se sumó porque no tiene foto. <Link href={`/catalogo/${p.id}`} target="_blank">Subir foto</Link></>)
  for (const f of d.filas) {
    const sinPrecio = f.productos.filter((p) => f.precioFijo == null && !baseDe(info, p.id, d.listaId, p.presentacion))
    for (const p of sinPrecio) avisos.push(<>«{info[p.id]?.nombre ?? 'Producto'}» no tiene precio {nombreLista}: sale «Consultar».</>)
    if (f.tipo === 'variantes') {
      const precios = new Set(f.productos.map((p) => precioPromo(baseDe(info, p.id, d.listaId, p.presentacion)?.precio ?? null, f)).filter((x) => x != null))
      if (precios.size > 1) avisos.push(<>«{f.titulo || tituloComun(f.productos.map((p) => info[p.id]?.nombre ?? ''))}»: los sabores tienen distinto precio; sale el más bajo con «desde».</>)
    }
  }
  if (d.filas.length && estadoPromo(d.desde, d.hasta) === 'vencida') avisos.push(`La vigencia ya terminó (${fechaCorta(d.hasta)}): cambiá las fechas si la vas a usar de nuevo.`)
  return { bloquean, avisos }
}

export function EditorPromo({ id, inicial, infoInicial, placasIniciales, listas, exportacionInicial, elegidos, erpFaltantes, erpSinFoto, descuentoInicial, contacto, hashtags, ia }: Props) {
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
  const router = useRouter()

  // ---------- guardado automático (0,7 s después del último cambio) ----------
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

  /** Antes de exportar o duplicar: que lo último esté guardado. */
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

  const presentes = new Set(datos.filas.flatMap((f) => f.productos.map((p) => p.id)))

  /** Suma productos del buscador: cada uno en su fila, con 10 % de entrada. */
  async function sumarProductos(ids: number[]) {
    const nuevos = ids.filter((x) => !presentes.has(x))
    if (!nuevos.length) return
    const extra = await infoParaSumar(nuevos)
    setInfo((x) => ({ ...x, ...extra }))
    setFilas((fs) => [...fs, ...nuevos.filter((x) => extra[x]).map((x): FilaEditor => ({ tipo: 'producto', titulo: null, descuento: descuentoInicial, cantidadMinima: null, precioFijo: null, origen: 'manual', productos: [{ id: x }] }))])
  }

  function sumar(origen: 'seleccion' | 'erp') {
    empezarSumar(async () => {
      const r = await filasParaSumar(origen, [...presentes])
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
  const totalProductos = presentes.size
  const estadoVig = ESTADO[estadoPromo(datos.desde, datos.hasta)]
  const lista = listas.find((l) => l.id === datos.listaId)
  const nombreLista = (lista?.nombre ?? '').toLowerCase()
  const rev = revisar(datos, info, erpSinFoto, nombreLista)
  const titulo = datos.titulo || 'PROMOCIONES'
  const vigencia = textoVigencia(datos.desde, datos.hasta).toLowerCase()

  // Texto del posteo: se arma solo con la promo; se puede editar o mejorar con IA
  const nombresProductos = [...presentes].slice(0, 8).map((x) => info[x]?.nombre).filter((x): x is string => !!x)
  const posteoAuto = textoPosteo('promo', { titulo: datos.titulo || 'PROMOCIONES', bajada: vigencia, productos: nombresProductos, contacto, hashtags })

  return (
    <ContextoIA.Provider value={ia}>
    <div className="contenido">
      <Cabecera
        titulo={<>{titulo} <span className={`chip chip-titulo ${estadoVig.clase}`}>{estadoVig.texto}</span></>}
        subtitulo={`${vigencia.charAt(0).toUpperCase()}${vigencia.slice(1)} · ${totalProductos ? `${plural(totalProductos, 'producto', 'productos')} en ${plural(datos.filas.length, 'fila', 'filas')}` : 'sin productos todavía'} · solo diseño: no cambia precios en el ERP`}
        miga={[{ texto: 'Promos', href: '/promos' }, { texto: `${titulo} · ${vigencia}` }]}
        acciones={
          <>
            <EstadoGuardado estado={estado} />
            <button className="btn" disabled={yendo} onClick={() => empezarIr(async () => { await guardarYa(); await duplicarPromo(id) })}><Icono nombre="content_copy" />Duplicar</button>
            <Exportar exportar={() => exportarPromo(id)} inicial={exportacionInicial} antes={guardarYa} habilitado={placas.length > 0 && !rev.bloquean.length} motivo={!totalProductos ? 'Sumá productos primero' : rev.bloquean.length ? 'Revisá lo que falta (a la derecha)' : ''} />
            <button className="btn" disabled={yendo || placas.length === 0 || rev.bloquean.length > 0} title={placas.length === 0 || rev.bloquean.length > 0 ? 'Revisá lo que falta (a la derecha)' : 'Publicar en Instagram y Facebook'} onClick={() => empezarIr(async () => { await guardarYa(); router.push(`/publicaciones/nueva?promo=${id}`) })}><Icono nombre="send" />Publicar</button>
          </>
        }
      />

      <div className="editor-promo">
        {/* ---------- ajustes ---------- */}
        <section className="tarjeta editor-ajustes" aria-label="Ajustes de la promo">
          <label className="campo">
            <span className="rotulo-columna">Título</span>
            <input className="input" value={datos.titulo} maxLength={24} onChange={(e) => cambiar({ titulo: e.target.value.toUpperCase() })} placeholder="PROMOCIONES" />
            <span className="texto-chico">Hasta 24 letras: si es largo, se achica solo para entrar.</span>
          </label>
          <div className="campo">
            <span className="rotulo-columna">Vigencia</span>
            <div className="fila-fechas">
              <input className="input" type="date" aria-label="Desde" value={datos.desde} onChange={(e) => e.target.value && cambiar({ desde: e.target.value, hasta: e.target.value > datos.hasta ? e.target.value : datos.hasta })} />
              <input className="input" type="date" aria-label="Hasta" value={datos.hasta} min={datos.desde} onChange={(e) => e.target.value && e.target.value >= datos.desde && cambiar({ hasta: e.target.value })} />
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
            <div className="opciones-diseno" role="radiogroup" aria-label="Diseño">
              {(['1', '2'] as const).map((n) => (
                <button key={n} role="radio" aria-checked={datos.diseno === n} className={`opcion-diseno ${datos.diseno === n ? 'opcion-diseno-activa' : ''}`} onClick={() => cambiar({ diseno: n })}>
                  <img src={`/interfaz/promo-diseno-${n}.jpg`} alt="" />
                  <span>{n === '1' ? '1 · Logo en círculo' : '2 · Cinta verde'}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="campo">
            <span className="rotulo-columna">Precios de</span>
            <select className="input" value={datos.listaId} onChange={(e) => cambiar({ listaId: Number(e.target.value) })}>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </label>
          <p className="texto-chico">Contacto en todas las placas: {contacto.web} · WhatsApp {contacto.whatsapp} · {contacto.instagram} (se cambia en Configuración).</p>
          <button className="enlace texto-chico borrar-promo" disabled={yendo} onClick={() => { if (confirm('¿Borrar esta promo? No se puede deshacer.')) empezarIr(() => borrarPromo(id)) }}>Borrar promo</button>
        </section>

        {/* ---------- vista previa ---------- */}
        {placa ? (
          <section className="editor-vista" aria-label="Vista previa">
            <VistaPlaca ruta={`${placa.ruta}&v=${version}`} formato={placa.formato} />
            <div className="tira-placas" role="tablist" aria-label="Placas">
              {placas.map((p, i) => (
                <button key={p.ruta} role="tab" aria-selected={p === placa} className={`tira-placa ${p === placa ? 'tira-placa-activa' : ''}`} onClick={() => setElegida(i)}>
                  <MiniPlaca ruta={`${p.ruta}&v=${version}`} formato={p.formato} />
                  <span>{NOMBRE_FORMATO[p.formato]}{p.paginas > 1 ? ` ${p.pagina}/${p.paginas}` : ''}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="editor-vacio">
            <Icono nombre={datos.filas.length ? 'image_not_supported' : 'add_shopping_cart'} tamano={44} />
            {datos.filas.length ? (
              <><b>Elegí al menos un formato</b><span>Historias, feed o uno por producto, en la columna de la izquierda.</span></>
            ) : (
              <><b>Sumá productos para armar la promo</b><span>Buscalos acá al lado o elegilos con las casillas del <Link href="/catalogo">catálogo</Link>.<br />Las promos de la lista Promo del ERP se suman solas si tienen foto.</span></>
            )}
          </section>
        )}

        {/* ---------- productos ---------- */}
        <section className="editor-filas" aria-label="Productos de la promo">
          <Buscador buscar={buscarParaPromo} listaId={datos.listaId} presentes={presentes} alSumar={sumarProductos} enfocar={!datos.filas.length} />
          {(quedanElegidos > 0 || quedanErp > 0) && (
            <div className="sumar-filas">
              {quedanElegidos > 0 && <button className="btn btn-chico" disabled={sumando} onClick={() => sumar('seleccion')}><Icono nombre="playlist_add" tamano={16} />Sumar {plural(quedanElegidos, 'elegido', 'elegidos')} del catálogo</button>}
              {quedanErp > 0 && <button className="btn btn-chico" disabled={sumando} onClick={() => sumar('erp')}><Icono nombre="sync" tamano={16} />Sumar promos del ERP ({quedanErp})</button>}
            </div>
          )}
          {(rev.bloquean.length > 0 || rev.avisos.length > 0) && (
            <div className={`revision ${rev.bloquean.length ? 'revision-bloquea' : ''}`} role="status">
              <b><Icono nombre={rev.bloquean.length ? 'error' : 'info'} tamano={16} />{rev.bloquean.length ? 'Para exportar falta:' : 'Antes de exportar, revisá:'}</b>
              <ul>
                {[...rev.bloquean, ...rev.avisos].map((t, k) => <li key={k}>{t}</li>)}
              </ul>
            </div>
          )}
          {datos.filas.length > 0 && <span className="rotulo-columna">Filas · arrastrá para ordenar</span>}
          {datos.filas.map((f, i) => (
            <TarjetaFila
              key={`${i}-${f.productos.map((p) => p.id).join('-')}`}
              fila={f}
              i={i}
              total={datos.filas.length}
              info={info}
              listaId={datos.listaId}
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
          {datos.filas.length > 0 && (
            <div className="tarjeta panel-posteo">
              <span className="rotulo-columna">Texto del posteo</span>
              <textarea className="input area" rows={6} value={datos.textoPosteo ?? posteoAuto} onChange={(e) => cambiar({ textoPosteo: e.target.value })} aria-label="Texto del posteo" />
              <div className="foto-acciones">
                <button className="btn btn-chico" onClick={() => void navigator.clipboard?.writeText(datos.textoPosteo ?? posteoAuto)}><Icono nombre="content_copy" tamano={16} />Copiar texto</button>
                <BotonIA texto="Mejorar con IA" pedir={() => accionMejorarTexto(`promo «${datos.titulo}» ${vigencia}`, [...presentes], datos.textoPosteo ?? posteoAuto)} alObtener={(t) => cambiar({ textoPosteo: t })} />
                {datos.textoPosteo != null && <button className="enlace texto-chico" onClick={() => cambiar({ textoPosteo: null })}>Volver al texto automático</button>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
    </ContextoIA.Provider>
  )
}

// ---------------------------------------------------------------------------
// Una fila de la promo
// ---------------------------------------------------------------------------
type Acciones = { subir: () => void; bajar: () => void; grupo: (() => void) | null; variantes: (() => void) | null; separar: (() => void) | null; quitar: () => void }

function TarjetaFila(p: {
  fila: FilaEditor; i: number; total: number; info: Record<number, InfoProducto>; listaId: number; resaltada: boolean
  onDragStart: () => void; onDragOver: () => void; onDrop: () => void; onDragEnd: () => void
  cambiar: (x: Partial<FilaEditor>) => void
  cambiarItem: (pid: number, x: { nombre?: string | null; tam?: string | null; presentacion?: string | null }) => void
  quitarProducto: (pid: number) => void
  acciones: Acciones
}) {
  const { fila: f, info, listaId, acciones } = p
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [nombres, setNombres] = useState(false)
  const menu = useRef<HTMLDetailsElement>(null)
  const prods = f.productos.map((x) => info[x.id])
  const nombresProd = prods.map((x) => x?.nombre ?? 'Producto')
  const cortos = nombresCortos(nombresProd)
  const sugerido = f.tipo === 'producto' ? nombresProd[0] : tituloComun(nombresProd) || 'Promo'
  const erp = f.origen === 'erp'

  // Precios: el que se ve en la placa (el más bajo con «desde» si cambian entre productos)
  const precios = f.productos.map((x) => {
    const b = baseDe(info, x.id, listaId, x.presentacion)
    return { base: b?.precio ?? null, unidad: b?.unidad ?? 'c/u', promo: precioPromo(b?.precio ?? null, f) }
  })
  const conPrecio = precios.filter((x) => x.promo != null).sort((a, b) => a.promo! - b.promo!)
  const distintos = new Set(conPrecio.map((x) => x.promo)).size > 1
  const n = f.cantidadMinima ?? 1
  const etiqueta = erp && n > 1 ? textoPrecioErp(f.precioFijo ?? 0, n) : textoOferta(f)

  let lineaPrecio: ReactNode = 'Sin precio en esta lista'
  if (conPrecio.length) {
    const x = conPrecio[0]
    if (erp && n > 1) lineaPrecio = <>{x.base != null && <>{textoPrecioErp(x.base, n)} → </>}<b>{textoPrecioErp(f.precioFijo ?? 0, n)}</b></>
    else if (distintos && f.tipo === 'grupo') lineaPrecio = <>Cada uno con su precio: <b>de {pesosPromo(conPrecio[0].promo!)} a {pesosPromo(conPrecio[conPrecio.length - 1].promo!)}</b></>
    else lineaPrecio = <>{distintos && 'desde '}{x.base != null && x.base !== x.promo && <>{pesosPromo(x.base)} → </>}<b>{pesosPromo(x.promo!)}</b> {x.unidad}</>
  }

  const hacer = (fn: (() => void) | null) => () => { if (menu.current) menu.current.open = false; fn?.() }

  return (
    <article
      className={`fila-promo ${p.resaltada ? 'fila-promo-destino' : ''}`}
      draggable={!menuAbierto}
      onDragStart={(e) => { if ((e.target as HTMLElement).closest('input, select, button')) { e.preventDefault(); return } e.dataTransfer.effectAllowed = 'move'; p.onDragStart() }}
      onDragOver={(e) => { e.preventDefault(); p.onDragOver() }}
      onDrop={(e) => { e.preventDefault(); p.onDrop() }}
      onDragEnd={p.onDragEnd}
    >
      <div className="fila-promo-cabeza">
        <Icono nombre="drag_indicator" className="asa" />
        <span className={`chip chip-tipo-${f.tipo}`}>{TIPO[f.tipo]}</span>
        {erp && <span className="chip chip-erp" title="Viene de la lista Promo del ERP: el precio es el del ERP">ERP</span>}
        <input className="input input-titulo-fila" value={f.titulo ?? ''} placeholder={sugerido} maxLength={60} aria-label="Título en el flyer" onChange={(e) => p.cambiar({ titulo: e.target.value || null })} />
        <details className="menu-fila" ref={menu} onToggle={(e) => setMenuAbierto((e.target as HTMLDetailsElement).open)}>
          <summary className="superior-boton" aria-label="Más opciones"><Icono nombre="more_vert" /></summary>
          <div className="menu-fila-opciones">
            <button disabled={p.i === 0} onClick={hacer(acciones.subir)}><Icono nombre="arrow_upward" tamano={16} />Subir</button>
            <button disabled={p.i === p.total - 1} onClick={hacer(acciones.bajar)}><Icono nombre="arrow_downward" tamano={16} />Bajar</button>
            <button disabled={!acciones.grupo} onClick={hacer(acciones.grupo)}><Icono nombre="view_module" tamano={16} />Juntar con la de abajo (grupo)</button>
            <button disabled={!acciones.variantes} onClick={hacer(acciones.variantes)}><Icono nombre="style" tamano={16} />Juntar con la de abajo (sabores)</button>
            <button disabled={!acciones.separar} onClick={hacer(acciones.separar)}><Icono nombre="call_split" tamano={16} />Separar en productos</button>
            <button onClick={hacer(acciones.quitar)} className="menu-peligro"><Icono nombre="delete" tamano={16} />Quitar fila</button>
          </div>
        </details>
      </div>

      <div className="fila-promo-fotos">
        {f.productos.map((x, k) => (
          <span key={x.id} className={`miniatura ${prods[k]?.foto ? '' : 'miniatura-falta'}`} title={nombresProd[k]}>
            {prods[k]?.foto ? <img src={prods[k].foto!} alt="" /> : <Icono nombre="no_photography" tamano={16} />}
            {f.productos.length > 1 && (
              <button className="quitar-producto" onClick={() => p.quitarProducto(x.id)} aria-label={`Sacar ${nombresProd[k]}`}><Icono nombre="close" tamano={12} /></button>
            )}
          </span>
        ))}
      </div>
      {f.tipo === 'variantes' && <div className="texto-chico">Sabores: {cortos.map((c, k) => f.productos[k].nombre || c.nombre).join(' · ')}</div>}

      {erp ? (
        <div className="texto-chico">Promo cargada en el ERP: el precio no se cambia acá.</div>
      ) : (
        <div className="fila-promo-regla">
          <label>Descuento <input className="input input-num" inputMode="decimal" value={f.descuento ?? ''} onChange={(e) => { const v = numeroONull(e.target.value); if (v !== undefined && (v ?? 0) <= 90) p.cambiar({ descuento: v }) }} aria-label="Descuento en %" /> %</label>
          <label>Llevando <input className="input input-num" inputMode="numeric" value={f.cantidadMinima ?? ''} placeholder="—" onChange={(e) => { const v = numeroONull(e.target.value); if (v !== undefined && (v == null || Number.isInteger(v))) p.cambiar({ cantidadMinima: v || null }) }} aria-label="Cantidad mínima" /> o más</label>
        </div>
      )}
      <div className="fila-promo-precio">
        <span>{lineaPrecio}</span>
        <span className="chip etiqueta-oferta">{etiqueta}</span>
      </div>

      <button className="enlace texto-chico fila-promo-nombres" onClick={() => setNombres(!nombres)}>
        <Icono nombre={nombres ? 'expand_less' : 'edit'} tamano={14} />{nombres ? 'Ocultar' : f.tipo === 'producto' && !prods[0]?.granel ? 'Nombre' : 'Nombres, medidas y precio de granel'}
      </button>
      {nombres && (
        <div className="nombres-fila">
          {f.tipo === 'producto' && <p className="texto-chico">El nombre de un producto solo se cambia en el título de la fila (arriba).</p>}
          {f.productos.map((x, k) => {
            const pr = prods[k]
            const granel = pr?.granel && pr.presentaciones.length > 0 && !erp
            if (f.tipo === 'producto' && !granel) return null
            return (
              <div key={x.id} className="nombre-item">
                {f.tipo !== 'producto' && <input className="input" value={x.nombre ?? ''} placeholder={cortos[k].nombre} maxLength={40} aria-label="Nombre" onChange={(e) => p.cambiarItem(x.id, { nombre: e.target.value || null })} />}
                {f.tipo !== 'producto' && <input className="input input-tam" value={x.tam ?? ''} placeholder={cortos[k].tam ?? 'medida'} maxLength={20} aria-label="Medida" onChange={(e) => p.cambiarItem(x.id, { tam: e.target.value || null })} />}
                {granel && (
                  <select className="input input-tam" value={x.presentacion ?? ''} aria-label="Precio de" onChange={(e) => p.cambiarItem(x.id, { presentacion: e.target.value || null })}>
                    <option value="">Por kilo</option>
                    {pr!.presentaciones.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

