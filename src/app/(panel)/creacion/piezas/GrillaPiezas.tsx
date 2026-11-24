'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import type { TipoPieza } from '@/lib/creacion/borrar-reglas'
import { accionBorrarPiezas, type PiezaFrenada } from '../acciones-borrar'
import { imagenMini } from '@/lib/miniaturas'

export type TarjetaPieza = {
  tipo: TipoPieza
  id: number
  titulo: string
  detalle: string
  formatos: string[]
  reel: boolean
  imagen: string | null
  editar: string
  estado: string
  claseEstado: string
  publicada: boolean
  cuando: string
}

const clave = (p: { tipo: TipoPieza; id: number }) => `${p.tipo}-${p.id}`
const ICONO: Record<TipoPieza, string> = { carrusel: 'view_carousel', promo: 'sell', video: 'videocam' }
const TIPO: Record<TipoPieza, string> = { carrusel: 'Carrusel', promo: 'Promo', video: 'Video propio' }

/** Las tarjetas de Mis piezas, con casillas para elegir varias y borrar de una (o de a una con su botón). */
export function GrillaPiezas({ piezas }: { piezas: TarjetaPieza[] }) {
  const router = useRouter()
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [borrando, empezar] = useTransition()
  const [resultado, setResultado] = useState<{ borradas: number; frenadas: PiezaFrenada[] } | null>(null)

  const alternar = (k: string) => setElegidas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const borrar = (lista: TarjetaPieza[]) => {
    const texto = lista.length === 1 ? `¿Borrar «${lista[0].titulo}»?` : `¿Borrar estas ${lista.length} piezas?`
    const publicadas = lista.filter((p) => p.publicada).length
    const aclaracion = publicadas ? `\n\n${publicadas === 1 ? 'Una ya se publicó' : `${publicadas} ya se publicaron`}: en Instagram y Facebook quedan; se borran solo de acá.` : ''
    if (!confirm(`${texto} No se puede deshacer.${aclaracion}`)) return
    empezar(async () => {
      const r = await accionBorrarPiezas(lista.map(({ tipo, id }) => ({ tipo, id })))
      setResultado(r)
      setElegidas(new Set())
      router.refresh()
    })
  }
  const elegidasLista = piezas.filter((p) => elegidas.has(clave(p)))

  return (
    <>
      {resultado && (
        <div className="avisos-borrado">
          {resultado.borradas > 0 && <Aviso tono="verde" dato={resultado.borradas === 1 ? 'Se borró 1 pieza.' : `Se borraron ${resultado.borradas} piezas.`} />}
          {resultado.frenadas.map((f) => (
            <Aviso key={clave(f)} tono="ambar" dato={`«${f.titulo}» no se borró.`} accion={f.enlace && <Link prefetch={false} className="btn btn-chico" href={f.enlace}>Ir</Link>}>
              {f.motivo}
            </Aviso>
          ))}
        </div>
      )}
      <div className="grilla-piezas">
        {piezas.map((p) => {
          const k = clave(p)
          return (
            <article key={k} className={`tarjeta-pieza ${elegidas.has(k) ? 'tarjeta-pieza-elegida' : ''}`}>
              <div className="tarjeta-pieza-arriba">
                <Link prefetch={false} href={p.editar} className="tarjeta-pieza-imagen">
                  {p.imagen ? <img {...imagenMini(p.imagen, 300)} alt="" loading="lazy" /> : <span className="tarjeta-pieza-vacia"><Icono nombre={ICONO[p.tipo]} tamano={36} /></span>}
                  {p.reel && <span className="tarjeta-pieza-video"><Icono nombre="play_arrow" tamano={14} />Reel</span>}
                </Link>
                <label className="casilla tarjeta-pieza-casilla" title="Elegir para borrar">
                  <input type="checkbox" checked={elegidas.has(k)} onChange={() => alternar(k)} aria-label={`Elegir «${p.titulo}»`} />
                </label>
              </div>
              <div className="tarjeta-pieza-cuerpo">
                <Link prefetch={false} href={p.editar}><b>{p.titulo}</b></Link>
                <span className="texto-chico">{TIPO[p.tipo]} · {p.detalle}</span>
                <div className="chips">{p.formatos.map((f) => <span key={f} className="chip chip-mini">{f}</span>)}</div>
                <div className="fila-separada">
                  <span className={`chip ${p.claseEstado}`}>{p.estado}</span>
                  <span className="texto-chico">{p.cuando}</span>
                </div>
                <div className="fila-chips">
                  <Link prefetch={false} className="btn btn-chico" href={p.editar}><Icono nombre="edit" tamano={16} />Editar</Link>
                  <Link prefetch={false} className="btn btn-chico" href={`/publicaciones/nueva?${p.tipo}=${p.id}`}><Icono nombre="send" tamano={16} />Publicar</Link>
                  <button className="btn btn-chico btn-solo-icono" disabled={borrando} onClick={() => borrar([p])} aria-label={`Borrar «${p.titulo}»`} title="Borrar"><Icono nombre="delete" tamano={18} /></button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {elegidas.size > 0 && (
        <div className="barra-seleccion" role="region" aria-label="Piezas elegidas">
          <div className="barra-seleccion-fila">
            <b className="seleccion-cuenta">{elegidas.size} {elegidas.size === 1 ? 'elegida' : 'elegidas'}</b>
            <span className="barra-seleccion-botones">
              <button className="btn btn-chico" onClick={() => setElegidas(new Set(piezas.map(clave)))} disabled={borrando}><Icono nombre="done_all" tamano={16} />Elegir las {piezas.length}</button>
              <button className="btn btn-chico" onClick={() => setElegidas(new Set())} disabled={borrando}><Icono nombre="remove_done" tamano={16} />Ninguna</button>
              <button className="btn btn-chico" onClick={() => borrar(elegidasLista)} disabled={borrando || !elegidasLista.length}>
                <Icono nombre="delete" tamano={16} />{borrando ? 'Borrando…' : `Borrar ${elegidasLista.length === 1 ? 'la elegida' : `las ${elegidasLista.length}`}`}
              </button>
            </span>
          </div>
        </div>
      )}
    </>
  )
}
