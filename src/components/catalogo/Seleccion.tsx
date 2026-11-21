'use client'

import { createContext, useContext, useOptimistic, useState, useTransition, type ReactNode } from 'react'
import { Icono } from '@/components/Icono'
import { marcarProductos, vaciarSeleccion } from '@/app/seleccion-acciones'
import { crearPromoDesdeSeleccion } from '@/app/(panel)/promos/acciones'

type Elegido = { id: number; nombre: string; foto: string | null }
type Cambio = { ids: number[]; marcar: boolean } | { vaciar: true }
type Ctx = { elegidos: Set<number>; cambiar: (ids: number[], marcar: boolean) => void; pendiente: boolean }

const Contexto = createContext<Ctx | null>(null)
const usar = () => {
  const c = useContext(Contexto)
  if (!c) throw new Error('Falta <SeleccionCatalogo>')
  return c
}

/**
 * Lo elegido con las casillas vive en la base (tabla `seleccion`), así no se pierde al cambiar de página,
 * de filtro o de dispositivo. Acá solo se muestra al instante mientras se guarda.
 */
export function SeleccionCatalogo({ elegidos, children }: { elegidos: Elegido[]; children: ReactNode }) {
  const [pendiente, empezar] = useTransition()
  const [ids, aplicar] = useOptimistic(new Set(elegidos.map((e) => e.id)), (actual, c: Cambio) => {
    if ('vaciar' in c) return new Set<number>()
    const nuevo = new Set(actual)
    for (const id of c.ids) (c.marcar ? nuevo.add(id) : nuevo.delete(id))
    return nuevo
  })
  const cambiar = (lista: number[], marcar: boolean) =>
    empezar(async () => {
      aplicar({ ids: lista, marcar })
      await marcarProductos(lista, marcar)
    })
  const vaciar = () =>
    empezar(async () => {
      aplicar({ vaciar: true })
      await vaciarSeleccion()
    })
  return (
    <Contexto.Provider value={{ elegidos: ids, cambiar, pendiente }}>
      {children}
      <BarraSeleccion ids={ids} elegidos={elegidos} vaciar={vaciar} cambiar={cambiar} pendiente={pendiente} />
    </Contexto.Provider>
  )
}

/** Casilla de una fila. Sin foto, dado de baja o «no va en piezas» no se puede elegir. */
export function CasillaProducto({ id, nombre, motivo }: { id: number; nombre: string; motivo: string | null }) {
  const { elegidos, cambiar } = usar()
  return (
    <label className="casilla" title={motivo ?? (elegidos.has(id) ? 'Sacar de los elegidos' : 'Elegir para una promo')}>
      <input type="checkbox" checked={elegidos.has(id)} disabled={!!motivo} onChange={(e) => cambiar([id], e.target.checked)} aria-label={`Elegir ${nombre}`} />
    </label>
  )
}

/** Casilla del encabezado: elige o saca todos los de esta página que se pueden usar. */
export function CasillaPagina({ ids }: { ids: number[] }) {
  const { elegidos, cambiar } = usar()
  const marcados = ids.filter((id) => elegidos.has(id)).length
  const todos = ids.length > 0 && marcados === ids.length
  return (
    <label className="casilla" title={todos ? 'Sacar los de esta página' : 'Elegir todos los de esta página'}>
      <input
        type="checkbox"
        checked={todos}
        disabled={!ids.length}
        ref={(el) => { if (el) el.indeterminate = marcados > 0 && !todos }}
        onChange={() => cambiar(ids, !todos)}
        aria-label="Elegir todos los de esta página"
      />
    </label>
  )
}

function BarraSeleccion({ ids, elegidos, vaciar, cambiar, pendiente }: { ids: Set<number>; elegidos: Elegido[]; vaciar: () => void; cambiar: Ctx['cambiar']; pendiente: boolean }) {
  const [abierta, setAbierta] = useState(false)
  const [armando, empezarArmar] = useTransition()
  const visibles = elegidos.filter((e) => ids.has(e.id))
  if (!ids.size) return null
  const n = ids.size
  return (
    <div className="barra-seleccion" role="region" aria-label="Productos elegidos">
      {abierta && (
        <div className="seleccion-lista">
          <div className="seleccion-lista-cabeza">
            <b>Elegidos ({n})</b>
            <button className="superior-boton" onClick={() => setAbierta(false)} aria-label="Cerrar"><Icono nombre="close" /></button>
          </div>
          <ul>
            {visibles.map((e) => (
              <li key={e.id}>
                <span className="miniatura">{e.foto && <img src={e.foto} alt="" />}</span>
                <span className="seleccion-nombre">{e.nombre}</span>
                <button className="btn btn-chico" onClick={() => cambiar([e.id], false)}>Sacar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="barra-seleccion-fila">
        <b className="seleccion-cuenta">{n} {n === 1 ? 'elegido' : 'elegidos'}</b>
        <span className="seleccion-miniaturas" aria-hidden="true">
          {visibles.slice(0, 6).map((e) => (
            <span key={e.id} className="miniatura">{e.foto && <img src={e.foto} alt="" />}</span>
          ))}
          {visibles.length > 6 && <span className="texto-chico">+{visibles.length - 6}</span>}
        </span>
        <span className="barra-seleccion-botones">
          <button className="btn btn-chico" onClick={() => setAbierta(!abierta)}><Icono nombre="list" tamano={16} />Ver elegidos</button>
          <button className="btn btn-chico" onClick={vaciar} disabled={pendiente}><Icono nombre="remove_done" tamano={16} />Vaciar</button>
          <a className="btn btn-chico" href="/creacion"><Icono nombre="palette" tamano={16} />Seguir en Creación</a>
          <a className="btn btn-chico" href="/carruseles/nuevo"><Icono nombre="view_carousel" tamano={16} />Armar carrusel</a>
          <button className="btn btn-chico btn-pri" disabled={pendiente || armando} onClick={() => empezarArmar(() => crearPromoDesdeSeleccion())}>
            <Icono nombre="sell" tamano={16} />{armando ? 'Armando…' : 'Armar promo'}
          </button>
        </span>
      </div>
    </div>
  )
}
