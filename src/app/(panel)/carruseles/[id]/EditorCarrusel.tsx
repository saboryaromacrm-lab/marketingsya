'use client'

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { Cabecera } from '@/components/Cabecera'
import { Icono } from '@/components/Icono'
import { Buscador, EstadoGuardado, Exportar, MiniPlaca, VistaPlaca, type Exportacion } from '@/components/piezas/Editor'
import type { EstiloCarrusel } from '@/lib/db/esquema'
import { pesosPromo, precioPromo } from '@/lib/promos/calculo'
import { enUnaLinea, etiquetaDeCategoria, fraseSugerida, lineaChica, nombreCorto, nombreEnPlaca, textoIngrediente, textoPosteo } from '@/lib/carruseles/textos'
import { datosIniciales, ESTILOS, idsDe, MAX, placasDe, type DatosCarrusel, type DatosLanzamiento, type DatosNutriofertas, type DatosRecetas, type Id } from '@/lib/carruseles/tipos'
import { buscarParaPromo } from '../../promos/acciones'
import { borrarCarrusel, duplicarCarrusel, exportarCarrusel, guardarCarrusel, infoProductosCarrusel, type InfoCarrusel } from '../acciones'

type Form = { titulo: string; estilo: EstiloCarrusel; listaId: number; datos: DatosCarrusel; textoPosteo: string | null }
type PlacaVista = { numero: number; nombre: string; ruta: string }
type Info = Record<number, InfoCarrusel>
type Props = { id: number; inicial: Form; infoInicial: Info; placasIniciales: PlacaVista[]; listas: { id: number; nombre: string }[]; exportacionInicial: Exportacion; elegidos: number }
type Ruta = (string | number)[]

/** Copia con un cambio en la ruta indicada (sin tocar el original). */
function conCambio<T>(obj: T, ruta: Ruta, valor: unknown): T {
  if (!ruta.length) return valor as T
  const [k, ...resto] = ruta
  const copia = (Array.isArray(obj) ? [...obj] : { ...(obj as object) }) as Record<string | number, unknown>
  copia[k] = conCambio((obj as Record<string | number, unknown>)[k], resto, valor)
  return copia as T
}

// ---------------------------------------------------------------------------
// Revisión antes de exportar
// ---------------------------------------------------------------------------
function revisar(f: Form, info: Info): { bloquean: string[]; avisos: string[] } {
  const bloquean: string[] = []
  const avisos: string[] = []
  const falta = (id: Id, donde: string) => {
    if (id == null) bloquean.push(`Elegí el producto de ${donde}.`)
    else if (info[id] && !info[id].foto) bloquean.push(`«${info[id].nombre}» (${donde}) no tiene foto: cambialo o subile una.`)
  }
  if (f.estilo === 'lanzamiento') {
    const d = f.datos as DatosLanzamiento
    d.portada.productos.forEach((id, i) => falta(id, `la portada (foto ${i + 1})`))
    if (d.placas.productos) {
      d.productos.items.forEach((it, i) => falta(it.id, `la placa de productos (${i + 1})`))
      if (d.productos.items.length < 6) avisos.push(`La placa de productos queda mejor con 6 (tiene ${d.productos.items.length}).`)
    }
    if (d.placas.comoComprar) falta(d.comoComprar.foto, '«Cómo comprar»')
  } else if (f.estilo === 'nutriofertas') {
    const d = f.datos as DatosNutriofertas
    falta(d.portada.producto, 'la portada')
    d.productos.forEach((it, i) => {
      falta(it.id, `la placa del producto ${i + 1}`)
      if (it.id != null && info[it.id] && !info[it.id].bases[it.presentacion ?? '']) avisos.push(`«${info[it.id].nombre}» no tiene precio en esta lista: sale «Consultá».`)
    })
  } else {
    const d = f.datos as DatosRecetas
    falta(d.portada.producto, 'la portada')
    d.ingredientes.items.forEach((it, i) => {
      falta(it.id, `el ingrediente ${i + 1}`)
      if (!it.cantidad.trim()) avisos.push(`Falta la cantidad del ingrediente ${i + 1} («½ taza», «1 cucharada»…).`)
    })
    falta(d.preparacion.foto, '«Preparación»')
    d.preparacion.pasos.forEach((p, i) => { if (!p.trim()) bloquean.push(`Escribí el paso ${i + 1} de la preparación.`) })
    if (d.placas.porQue) d.porQue.items.forEach((it, i) => falta(it.id, `«¿Por qué te hace bien?» (${i + 1})`))
  }
  return { bloquean, avisos }
}

function posteoAutomatico(f: Form, info: Info): string {
  const nombre = (id: Id) => (id != null && info[id] ? nombreCorto(info[id]) : null)
  const lista = (ids: Id[]) => [...new Set(ids.map(nombre).filter((x): x is string => !!x))]
  if (f.estilo === 'nutriofertas') {
    const d = f.datos as DatosNutriofertas
    return textoPosteo('nutriofertas', { titulo: enUnaLinea(d.portada.titulo), productos: lista(d.productos.map((p) => p.id)) })
  }
  if (f.estilo === 'recetas') {
    const d = f.datos as DatosRecetas
    return textoPosteo('recetas', { titulo: enUnaLinea(d.portada.titulo), bajada: d.ingredientes.bajada, productos: lista(d.ingredientes.items.map((p) => p.id)) })
  }
  const d = f.datos as DatosLanzamiento
  return textoPosteo('lanzamiento', { titulo: enUnaLinea(d.portada.titulo), bajada: d.productos.subtitulo, productos: lista(d.productos.items.map((p) => p.id)).slice(0, 4) })
}

export function EditorCarrusel({ id, inicial, infoInicial, placasIniciales, listas, exportacionInicial, elegidos }: Props) {
  const [form, setForm] = useState(inicial)
  const [info, setInfo] = useState(infoInicial)
  const [placas, setPlacas] = useState(placasIniciales)
  const [elegida, setElegida] = useState(0)
  const [version, setVersion] = useState(0)
  const [estado, setEstado] = useState<'guardado' | 'cambios' | 'guardando' | { error: string }>('guardado')
  const [yendo, empezarIr] = useTransition()

  // ---------- guardado automático (0,7 s después del último cambio) ----------
  const ultimo = useRef(inicial)
  const guardadoRef = useRef(inicial)
  const enCurso = useRef<Promise<void> | null>(null)
  const guardar = useCallback(async () => {
    const enviar = ultimo.current
    setEstado('guardando')
    const r = await guardarCarrusel(id, enviar)
    if ('error' in r) return setEstado({ error: r.error })
    guardadoRef.current = enviar
    setPlacas(r.placas)
    setVersion((v) => v + 1)
    setEstado(ultimo.current === enviar ? 'guardado' : 'cambios')
  }, [id])
  const primera = useRef(true)
  useEffect(() => {
    ultimo.current = form
    if (primera.current) { primera.current = false; return }
    setEstado('cambios')
    const t = setTimeout(() => { enCurso.current = guardar() }, 700)
    return () => clearTimeout(t)
  }, [form, guardar])
  async function guardarYa() {
    await enCurso.current
    if (ultimo.current !== guardadoRef.current) await guardar()
  }

  // Al cambiar la lista de precios, se vuelven a pedir los precios de todos los productos
  const listaPrevia = useRef(inicial.listaId)
  useEffect(() => {
    if (listaPrevia.current === form.listaId) return
    listaPrevia.current = form.listaId
    void infoProductosCarrusel(idsDe(form.estilo, form.datos), form.listaId).then((x) => setInfo((i) => ({ ...i, ...x })))
  }, [form.listaId, form.estilo, form.datos])

  const set = (ruta: Ruta, valor: unknown) => setForm((f) => ({ ...f, datos: conCambio(f.datos, ruta, valor) }))
  async function elegirProducto(ruta: Ruta, pid: number) {
    if (!info[pid]) {
      const extra = await infoProductosCarrusel([pid], form.listaId)
      setInfo((i) => ({ ...i, ...extra }))
    }
    set(ruta, pid)
  }

  function cambiarEstilo(nuevo: EstiloCarrusel) {
    if (nuevo === form.estilo) return
    if (!confirm(`¿Pasar este carrusel al estilo ${ESTILOS[nuevo].nombre}? Se mantienen los productos; los textos vuelven a los del estilo nuevo.`)) return
    setForm((f) => ({ ...f, estilo: nuevo, datos: datosIniciales(nuevo, idsDe(f.estilo, f.datos)), textoPosteo: null }))
    setElegida(0)
  }

  const lista = placasDe(form.estilo, form.datos)
  const indice = Math.min(elegida, lista.length - 1)
  const placa = lista[indice]
  const vista = placas[Math.min(indice, placas.length - 1)]
  const rev = revisar(form, info)
  const ids = idsDe(form.estilo, form.datos)
  const auto = posteoAutomatico(form, info)
  const exportado = exportacionInicial?.estado === 'ok'

  return (
    <div className="contenido">
      <Cabecera
        titulo={<>{form.titulo || ESTILOS[form.estilo].nombre} <span className={`chip chip-titulo ${exportado ? 'chip-ok' : 'chip-en_cola'}`}>{exportado ? 'EXPORTADO' : 'BORRADOR'}</span></>}
        subtitulo={`${ESTILOS[form.estilo].nombre} · ${lista.length} placas · ${ids.length} ${ids.length === 1 ? 'producto' : 'productos'}`}
        miga={[{ texto: 'Carruseles', href: '/carruseles' }, { texto: form.titulo || `N.º ${id}` }]}
        acciones={
          <>
            <EstadoGuardado estado={estado} />
            <button className="btn" disabled={yendo} onClick={() => empezarIr(async () => { await guardarYa(); await duplicarCarrusel(id) })}><Icono nombre="content_copy" />Duplicar</button>
            <Exportar exportar={() => exportarCarrusel(id)} inicial={exportacionInicial} antes={guardarYa} habilitado={!rev.bloquean.length} motivo="Revisá lo que falta (a la derecha)" />
          </>
        }
      />

      <div className="editor-promo">
        {/* ---------- ajustes ---------- */}
        <section className="tarjeta editor-ajustes" aria-label="Ajustes del carrusel">
          <label className="campo">
            <span className="rotulo-columna">Nombre (solo para vos)</span>
            <input className="input" value={form.titulo} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
          </label>
          <div className="campo">
            <span className="rotulo-columna">Estilo</span>
            <div className="opciones-estilo" role="radiogroup" aria-label="Estilo">
              {(Object.keys(ESTILOS) as EstiloCarrusel[]).map((e) => (
                <button key={e} role="radio" aria-checked={form.estilo === e} className={`opcion-diseno ${form.estilo === e ? 'opcion-diseno-activa' : ''}`} onClick={() => cambiarEstilo(e)}>
                  <img src={`/interfaz/carrusel-${e}.jpg`} alt="" />
                  <span>{ESTILOS[e].nombre}</span>
                </button>
              ))}
            </div>
          </div>
          <AjustesPlacas form={form} set={set} />
          {form.estilo === 'nutriofertas' && (
            <>
              <label className="campo">
                <span className="rotulo-columna">Precios de</span>
                <select className="input" value={form.listaId} onChange={(e) => setForm((f) => ({ ...f, listaId: Number(e.target.value) }))}>
                  {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </label>
              <div className="campo">
                <span className="rotulo-columna">Platos</span>
                <div className="opciones-lado">
                  {(['auto', 'derecha'] as const).map((v) => (
                    <button key={v} className={`btn btn-chico ${(form.datos as DatosNutriofertas).variante === v ? 'btn-pri' : ''}`} onClick={() => set(['variante'], v)}>{v === 'auto' ? 'Primero a la derecha' : 'Primero a la izquierda'}</button>
                  ))}
                </div>
                <span className="texto-chico">Se alternan solos de placa en placa.</span>
              </div>
            </>
          )}
          <p className="texto-chico">Cada carrusel cambia solo algunos detalles (giros, hojitas). Contacto y QR de la tienda en todas las placas de cierre.</p>
          <button className="enlace texto-chico borrar-promo" disabled={yendo} onClick={() => { if (confirm('¿Borrar este carrusel? No se puede deshacer.')) empezarIr(() => borrarCarrusel(id)) }}>Borrar carrusel</button>
        </section>

        {/* ---------- vista previa ---------- */}
        <section className="editor-vista" aria-label="Vista previa">
          {vista && <VistaPlaca ruta={`${vista.ruta}&v=${version}`} formato="carrusel" />}
          <div className="tira-placas" role="tablist" aria-label="Placas">
            {placas.map((p, i) => (
              <button key={p.ruta} role="tab" aria-selected={i === indice} className={`tira-placa ${i === indice ? 'tira-placa-activa' : ''}`} onClick={() => setElegida(i)}>
                <MiniPlaca ruta={`${p.ruta}&v=${version}`} formato="carrusel" />
                <span>{p.numero} · {p.nombre}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- placa elegida ---------- */}
        <section className="editor-filas" aria-label="Contenido de la placa">
          {(rev.bloquean.length > 0 || rev.avisos.length > 0) && (
            <div className={`revision ${rev.bloquean.length ? 'revision-bloquea' : ''}`} role="status">
              <b><Icono nombre={rev.bloquean.length ? 'error' : 'info'} tamano={16} />{rev.bloquean.length ? 'Para exportar falta:' : 'Antes de exportar, revisá:'}</b>
              <ul>{[...rev.bloquean, ...rev.avisos].map((t, k) => <li key={k}>{t}</li>)}</ul>
            </div>
          )}
          {elegidos > 0 && <p className="texto-chico">Tenés {elegidos} {elegidos === 1 ? 'producto elegido' : 'productos elegidos'} en el catálogo: buscalos con «Cambiar» en cada foto.</p>}
          {placa && (
            <div className="tarjeta panel-placa">
              <span className="rotulo-columna">Placa {indice + 1} · {placa.nombre}</span>
              <PanelPlaca key={`${form.estilo}-${placa.clave}`} form={form} info={info} clave={placa.clave} set={set} elegir={elegirProducto} irA={setElegida} indice={indice} />
            </div>
          )}
          <div className="tarjeta panel-posteo">
            <span className="rotulo-columna">Texto del posteo</span>
            <textarea className="input area" rows={7} value={form.textoPosteo ?? auto} onChange={(e) => setForm((f) => ({ ...f, textoPosteo: e.target.value }))} aria-label="Texto del posteo" />
            <div className="foto-acciones">
              <button className="btn btn-chico" onClick={() => void navigator.clipboard?.writeText(form.textoPosteo ?? auto)}><Icono nombre="content_copy" tamano={16} />Copiar texto</button>
              {form.textoPosteo != null && <button className="enlace texto-chico" onClick={() => setForm((f) => ({ ...f, textoPosteo: null }))}>Volver al texto automático</button>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Qué placas van
// ---------------------------------------------------------------------------
function AjustesPlacas({ form, set }: { form: Form; set: (r: Ruta, v: unknown) => void }) {
  const fija = (texto: string) => <label className="opcion-formato"><input type="checkbox" checked disabled /><span>{texto}</span><small>siempre</small></label>
  const opcion = (texto: string, ruta: Ruta, valor: boolean) => (
    <label className="opcion-formato"><input type="checkbox" checked={valor} onChange={(e) => set(ruta, e.target.checked)} /><span>{texto}</span></label>
  )
  if (form.estilo === 'lanzamiento') {
    const d = form.datos as DatosLanzamiento
    return (
      <div className="campo">
        <span className="rotulo-columna">Placas</span>
        {fija('Portada')}
        {opcion('Productos', ['placas', 'productos'], d.placas.productos)}
        {opcion('Cómo comprar', ['placas', 'comoComprar'], d.placas.comoComprar)}
        {opcion('¿Por qué Sabor y Aroma?', ['placas', 'porQue'], d.placas.porQue)}
        {fija('Tienda y QR')}
      </div>
    )
  }
  if (form.estilo === 'recetas') {
    const d = form.datos as DatosRecetas
    return (
      <div className="campo">
        <span className="rotulo-columna">Placas</span>
        {fija('Portada')}{fija('Ingredientes')}{fija('Preparación')}
        {opcion('¿Por qué te hace bien?', ['placas', 'porQue'], d.placas.porQue)}
        {fija('Tienda y QR')}
      </div>
    )
  }
  const d = form.datos as DatosNutriofertas
  return (
    <div className="campo">
      <span className="rotulo-columna">Placas</span>
      {fija('Portada')}
      <div className="opcion-formato"><span>Productos (una placa cada uno)</span><small>{d.productos.length} de {MAX.nutriProductos}</small></div>
      {fija('Tienda y QR')}
      <span className="texto-chico">Sumás o sacás productos desde la placa de cada producto.</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campos y elección de producto
// ---------------------------------------------------------------------------
function Campo({ rotulo, valor, alCambiar, placeholder, ayuda, area = false, max = 160 }: { rotulo: string; valor: string | null; alCambiar: (v: string) => void; placeholder?: string; ayuda?: ReactNode; area?: boolean; max?: number }) {
  return (
    <label className="campo">
      <span className="rotulo-columna">{rotulo}</span>
      {area ? (
        <textarea className="input area" rows={2} value={valor ?? ''} placeholder={placeholder} maxLength={max} onChange={(e) => alCambiar(e.target.value)} />
      ) : (
        <input className="input" value={valor ?? ''} placeholder={placeholder} maxLength={max} onChange={(e) => alCambiar(e.target.value)} />
      )}
      {ayuda && <span className="texto-chico">{ayuda}</span>}
    </label>
  )
}

function Producto({ id, info, alElegir, listaId = 3, rotulo }: { id: Id; info: Info; alElegir: (pid: number) => Promise<void>; listaId?: number; rotulo?: string }) {
  const [buscando, setBuscando] = useState(id == null)
  const p = id != null ? info[id] : undefined
  return (
    <div className="producto-placa">
      {rotulo && <span className="rotulo-columna">{rotulo}</span>}
      {p ? (
        <div className={`slot-producto ${p.foto ? '' : 'slot-falta'}`}>
          <span className="miniatura">{p.foto ? <img src={p.foto} alt="" /> : <Icono nombre="no_photography" tamano={18} />}</span>
          <span className="resultado-nombre">{p.nombre}<small>{p.foto ? (p.precio ?? 'Sin precio en esta lista') : <>Sin foto · <Link href={`/catalogo/${p.id}`} target="_blank">subile una</Link></>}</small></span>
          <button className="btn btn-chico" onClick={() => setBuscando(!buscando)}><Icono nombre={buscando ? 'close' : 'swap_horiz'} tamano={16} />{buscando ? 'Cerrar' : 'Cambiar'}</button>
        </div>
      ) : id != null ? <p className="texto-chico">Cargando…</p> : null}
      {buscando && (
        <Buscador
          buscar={buscarParaPromo}
          listaId={listaId}
          presentes={new Set(id != null ? [id] : [])}
          textoBoton="Elegir"
          placeholder={p ? 'Buscar otro producto…' : 'Buscar el producto…'}
          enfocar={id == null}
          alSumar={async ([pid]) => { await alElegir(pid); setBuscando(false) }}
        />
      )}
    </div>
  )
}

// Agregar, sacar y mover elementos de una lista
function Lista<T>({ items, max, min = 1, nuevo, set, ruta, render, textoSumar }: { items: T[]; max: number; min?: number; nuevo: () => T; set: (r: Ruta, v: unknown) => void; ruta: Ruta; render: (it: T, i: number) => ReactNode; textoSumar: string }) {
  const mover = (i: number, a: number) => { const c = [...items]; const [x] = c.splice(i, 1); c.splice(a, 0, x); set(ruta, c) }
  return (
    <div className="lista-placa">
      {items.map((it, i) => (
        <div key={i} className="item-placa">
          <div className="item-placa-cabeza">
            <b>{i + 1}</b>
            <span className="item-placa-botones">
              <button className="superior-boton" disabled={i === 0} onClick={() => mover(i, i - 1)} aria-label="Subir"><Icono nombre="arrow_upward" tamano={16} /></button>
              <button className="superior-boton" disabled={i === items.length - 1} onClick={() => mover(i, i + 1)} aria-label="Bajar"><Icono nombre="arrow_downward" tamano={16} /></button>
              <button className="superior-boton" disabled={items.length <= min} onClick={() => set(ruta, items.filter((_, k) => k !== i))} aria-label="Quitar"><Icono nombre="delete" tamano={16} /></button>
            </span>
          </div>
          {render(it, i)}
        </div>
      ))}
      {items.length < max && <button className="btn btn-chico" onClick={() => set(ruta, [...items, nuevo()])}><Icono nombre="add" tamano={16} />{textoSumar}</button>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lo que se edita en cada placa
// ---------------------------------------------------------------------------
function PanelPlaca({ form, info, clave, set, elegir, irA, indice }: { form: Form; info: Info; clave: string; set: (r: Ruta, v: unknown) => void; elegir: (r: Ruta, pid: number) => Promise<void>; irA: (i: number) => void; indice: number }) {
  const corte = 'La barra «/» corta el renglón.'
  const prod = (id: Id) => (id != null ? info[id] : undefined)

  if (form.estilo === 'lanzamiento') {
    const d = form.datos as DatosLanzamiento
    if (clave === 'portada') return (
      <>
        <Campo rotulo="Arriba del título" valor={d.portada.kicker} alCambiar={(v) => set(['portada', 'kicker'], v)} max={30} />
        <Campo rotulo="Título" valor={d.portada.titulo} alCambiar={(v) => set(['portada', 'titulo'], v)} ayuda={`${corte} El último renglón va en cursiva verde.`} />
        <Campo rotulo="Pastilla naranja" valor={d.portada.pastilla} alCambiar={(v) => set(['portada', 'pastilla'], v)} max={24} />
        <Campo rotulo="Abajo" valor={d.portada.pie} alCambiar={(v) => set(['portada', 'pie'], v)} max={40} />
        <Producto rotulo="Foto grande" id={d.portada.productos[0]} info={info} alElegir={(pid) => elegir(['portada', 'productos', 0], pid)} />
        <Producto rotulo="Foto chica" id={d.portada.productos[1]} info={info} alElegir={(pid) => elegir(['portada', 'productos', 1], pid)} />
      </>
    )
    if (clave === 'productos') return (
      <>
        <Campo rotulo="Título" valor={d.productos.titulo} alCambiar={(v) => set(['productos', 'titulo'], v)} ayuda={corte} />
        <Campo rotulo="Subtítulo" valor={d.productos.subtitulo} alCambiar={(v) => set(['productos', 'subtitulo'], v)} />
        <Lista items={d.productos.items} max={MAX.lanzamientoItems} nuevo={() => ({ id: null, etiqueta: null })} set={set} ruta={['productos', 'items']} textoSumar="Sumar foto"
          render={(it, i) => (
            <>
              <Producto id={it.id} info={info} alElegir={(pid) => elegir(['productos', 'items', i, 'id'], pid)} />
              <Campo rotulo="Etiqueta" valor={it.etiqueta} placeholder={etiquetaDeCategoria(prod(it.id)?.categoria)} alCambiar={(v) => set(['productos', 'items', i, 'etiqueta'], v || null)} max={24} />
            </>
          )} />
        <Campo rotulo="Abajo" valor={d.productos.pie} alCambiar={(v) => set(['productos', 'pie'], v)} />
      </>
    )
    if (clave === 'comoComprar') return (
      <>
        <Campo rotulo="Título" valor={d.comoComprar.titulo} alCambiar={(v) => set(['comoComprar', 'titulo'], v)} ayuda={corte} />
        <Producto rotulo="Foto de arriba" id={d.comoComprar.foto} info={info} alElegir={(pid) => elegir(['comoComprar', 'foto'], pid)} />
        {d.comoComprar.pasos.map((p, i) => (
          <div key={i} className="item-placa">
            <b>Paso {i + 1}</b>
            <Campo rotulo="Título del paso" valor={p.titulo} alCambiar={(v) => set(['comoComprar', 'pasos', i, 'titulo'], v)} max={40} />
            <Campo rotulo="Texto" valor={p.texto} area alCambiar={(v) => set(['comoComprar', 'pasos', i, 'texto'], v)} />
          </div>
        ))}
      </>
    )
    if (clave === 'porQue') return (
      <>
        <Campo rotulo="Título" valor={d.porQue.titulo} alCambiar={(v) => set(['porQue', 'titulo'], v)} ayuda={corte} />
        {d.porQue.sellos.map((s, i) => <Campo key={i} rotulo={`Sello ${i + 1}`} valor={s} alCambiar={(v) => set(['porQue', 'sellos', i], v)} max={30} ayuda={i === 0 ? corte : undefined} />)}
        {d.porQue.items.map((it, i) => (
          <div key={i} className="item-placa">
            <b>Recuadro {i + 1}</b>
            <Campo rotulo="En negrita" valor={it.titulo} alCambiar={(v) => set(['porQue', 'items', i, 'titulo'], v)} max={50} />
            <Campo rotulo="Texto" valor={it.texto} area alCambiar={(v) => set(['porQue', 'items', i, 'texto'], v)} />
          </div>
        ))}
      </>
    )
    return (
      <>
        <Campo rotulo="Título" valor={d.cierre.titulo} alCambiar={(v) => set(['cierre', 'titulo'], v)} ayuda={corte} />
        <Campo rotulo="Abajo" valor={d.cierre.pie} alCambiar={(v) => set(['cierre', 'pie'], v)} />
        <p className="texto-chico">El QR y la dirección de la tienda van siempre.</p>
      </>
    )
  }

  const portada = (base: Ruta, p: DatosNutriofertas['portada'] | DatosRecetas['portada']) => (
    <>
      <Campo rotulo="Título" valor={p.titulo} alCambiar={(v) => set([...base, 'titulo'], v)} ayuda={corte} />
      <Campo rotulo="Debajo del título" valor={p.bajada} alCambiar={(v) => set([...base, 'bajada'], v)} max={40} />
      <Campo rotulo="Destacado" valor={p.destacado} alCambiar={(v) => set([...base, 'destacado'], v)} max={30} />
      <Campo rotulo="Texto" valor={p.texto} area alCambiar={(v) => set([...base, 'texto'], v)} />
      <Campo rotulo="Botón" valor={p.boton} alCambiar={(v) => set([...base, 'boton'], v)} max={30} />
      <Campo rotulo="Sello" valor={p.sello} alCambiar={(v) => set([...base, 'sello'], v)} max={24} ayuda={corte} />
      <Producto rotulo="Foto del plato" id={p.producto} info={info} alElegir={(pid) => elegir([...base, 'producto'], pid)} />
    </>
  )
  const cierre = (c: { titulo: string; bajada: string }) => (
    <>
      <Campo rotulo="Título" valor={c.titulo} alCambiar={(v) => set(['cierre', 'titulo'], v)} ayuda={`${corte} El último renglón va destacado.`} />
      <Campo rotulo="Debajo del título" valor={c.bajada} alCambiar={(v) => set(['cierre', 'bajada'], v)} max={40} />
      <p className="texto-chico">El QR y la dirección de la tienda van siempre.</p>
    </>
  )

  if (form.estilo === 'nutriofertas') {
    const d = form.datos as DatosNutriofertas
    if (clave === 'portada') return portada(['portada'], d.portada)
    if (clave === 'cierre') return cierre(d.cierre)
    const k = Number(clave.split('-')[1])
    const it = d.productos[k]
    const p = prod(it.id)
    const base = p ? (p.bases[it.presentacion ?? ''] ?? null) : null
    const promo = base ? precioPromo(base.precio, { descuento: it.descuento, cantidadMinima: null, precioFijo: null }) : null
    const mover = (a: number) => { const c = [...d.productos]; const [x] = c.splice(k, 1); c.splice(a, 0, x); set(['productos'], c); irA(indice + (a - k)) }
    return (
      <>
        <Producto id={it.id} info={info} listaId={form.listaId} alElegir={(pid) => elegir(['productos', k, 'id'], pid)} />
        <Campo rotulo="Nombre en la placa" valor={it.nombre} placeholder={p ? nombreEnPlaca(p) : ''} alCambiar={(v) => set(['productos', k, 'nombre'], v || null)} ayuda={`${corte} Vacío: sale solo del nombre para piezas.`} max={60} />
        <Campo rotulo="Línea chica" valor={it.linea} placeholder={p ? lineaChica(p) : ''} alCambiar={(v) => set(['productos', k, 'linea'], v || null)} max={50} />
        {p?.granel && p.presentaciones.length > 0 && (
          <label className="campo">
            <span className="rotulo-columna">Precio de</span>
            <select className="input" value={it.presentacion ?? ''} onChange={(e) => set(['productos', k, 'presentacion'], e.target.value || null)}>
              <option value="">Por kilo</option>
              {p.presentaciones.map((x) => <option key={x.tamano} value={x.tamano}>{x.tamano}</option>)}
            </select>
          </label>
        )}
        <div className="fila-promo-regla">
          <label>Descuento <input className="input input-num" inputMode="decimal" value={it.descuento ?? 0} onChange={(e) => { const n = Number(e.target.value.replace(',', '.') || 0); if (Number.isFinite(n) && n >= 0 && n <= 90) set(['productos', k, 'descuento'], n) }} aria-label="Descuento en %" /> %</label>
          <span className="texto-chico">Precio NutriOferta: <b className="texto-verde">{promo != null ? `${pesosPromo(promo)} ${base!.unidad}` : 'sin precio'}</b>{it.descuento && base ? <> · antes {pesosPromo(base.precio)}</> : null}</span>
        </div>
        <Campo rotulo="Frase" valor={it.frase} area placeholder={p?.frase || fraseSugerida(p?.categoria)} alCambiar={(v) => set(['productos', k, 'frase'], v || null)} ayuda="Queda guardada en el producto para la próxima." />
        <div className="foto-acciones">
          <button className="btn btn-chico" disabled={k === 0} onClick={() => mover(k - 1)}><Icono nombre="arrow_back" tamano={16} />Antes</button>
          <button className="btn btn-chico" disabled={k === d.productos.length - 1} onClick={() => mover(k + 1)}><Icono nombre="arrow_forward" tamano={16} />Después</button>
          <button className="btn btn-chico" disabled={d.productos.length >= MAX.nutriProductos} onClick={() => { const c = [...d.productos]; c.splice(k + 1, 0, { id: null, nombre: null, linea: null, descuento: 0, frase: null, presentacion: null }); set(['productos'], c); irA(indice + 1) }}><Icono nombre="add" tamano={16} />Sumar producto</button>
          <button className="btn btn-chico" disabled={d.productos.length <= 1} onClick={() => { set(['productos'], d.productos.filter((_, x) => x !== k)); irA(Math.max(1, indice - (k === d.productos.length - 1 ? 1 : 0))) }}><Icono nombre="delete" tamano={16} />Sacar esta placa</button>
        </div>
      </>
    )
  }

  const d = form.datos as DatosRecetas
  if (clave === 'portada') return portada(['portada'], d.portada)
  if (clave === 'cierre') return cierre(d.cierre)
  if (clave === 'ingredientes') return (
    <>
      <Campo rotulo="Título" valor={d.ingredientes.titulo} alCambiar={(v) => set(['ingredientes', 'titulo'], v)} />
      <Campo rotulo="Debajo del título" valor={d.ingredientes.bajada} alCambiar={(v) => set(['ingredientes', 'bajada'], v)} placeholder="Para 1 bowl · avena nocturna" max={40} />
      <Lista items={d.ingredientes.items} max={MAX.ingredientes} nuevo={() => ({ id: null, cantidad: '', texto: null })} set={set} ruta={['ingredientes', 'items']} textoSumar="Sumar ingrediente"
        render={(it, i) => (
          <>
            <Producto id={it.id} info={info} alElegir={(pid) => elegir(['ingredientes', 'items', i, 'id'], pid)} />
            <div className="dos-campos">
              <Campo rotulo="Cantidad" valor={it.cantidad} placeholder="½ taza" alCambiar={(v) => set(['ingredientes', 'items', i, 'cantidad'], v)} max={24} />
              <Campo rotulo="Texto" valor={it.texto} placeholder={prod(it.id) ? textoIngrediente(prod(it.id)!) : ''} alCambiar={(v) => set(['ingredientes', 'items', i, 'texto'], v || null)} max={50} />
            </div>
          </>
        )} />
      <Campo rotulo="Sello" valor={d.ingredientes.sello} alCambiar={(v) => set(['ingredientes', 'sello'], v)} max={24} ayuda={corte} />
    </>
  )
  if (clave === 'preparacion') return (
    <>
      <Campo rotulo="Título" valor={d.preparacion.titulo} alCambiar={(v) => set(['preparacion', 'titulo'], v)} />
      <Producto rotulo="Foto del plato" id={d.preparacion.foto} info={info} alElegir={(pid) => elegir(['preparacion', 'foto'], pid)} />
      <Lista items={d.preparacion.pasos} max={MAX.pasos} min={MAX.pasosMin} nuevo={() => ''} set={set} ruta={['preparacion', 'pasos']} textoSumar="Sumar paso"
        render={(p, i) => <Campo rotulo={`Paso ${i + 1}`} valor={p} area placeholder="Mezclá la avena, la chía y la bebida en un frasco." alCambiar={(v) => set(['preparacion', 'pasos', i], v)} />} />
      <p className="texto-chico">«En {d.preparacion.pasos.length} pasos» se escribe solo.</p>
    </>
  )
  return (
    <>
      <Campo rotulo="Título" valor={d.porQue.titulo} alCambiar={(v) => set(['porQue', 'titulo'], v)} ayuda={corte} />
      <Campo rotulo="Sello" valor={d.porQue.sello} alCambiar={(v) => set(['porQue', 'sello'], v)} max={24} />
      <button className="btn btn-chico" onClick={() => set(['porQue', 'items'], d.ingredientes.items.filter((x) => x.id != null).slice(0, MAX.porQue).map((x) => ({ id: x.id, nombre: null, texto: null })))}><Icono nombre="content_copy" tamano={16} />Usar los ingredientes</button>
      <Lista items={d.porQue.items} max={MAX.porQue} nuevo={() => ({ id: null, nombre: null, texto: null })} set={set} ruta={['porQue', 'items']} textoSumar="Sumar recuadro"
        render={(it, i) => (
          <>
            <Producto id={it.id} info={info} alElegir={(pid) => elegir(['porQue', 'items', i, 'id'], pid)} />
            <Campo rotulo="Nombre" valor={it.nombre} placeholder={prod(it.id) ? nombreCorto(prod(it.id)!) : ''} alCambiar={(v) => set(['porQue', 'items', i, 'nombre'], v || null)} max={30} />
            <Campo rotulo="Por qué hace bien" valor={it.texto} area placeholder={prod(it.id)?.frase || fraseSugerida(prod(it.id)?.categoria)} alCambiar={(v) => set(['porQue', 'items', i, 'texto'], v || null)} ayuda="Queda guardada en el producto para la próxima." />
          </>
        )} />
    </>
  )
}
