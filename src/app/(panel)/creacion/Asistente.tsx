'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import type { DisponibilidadIA } from '@/lib/ia/disponibilidad'
import { crearDesdeAsistente, elegirConIA, sacarElegido, type TipoNueva } from './acciones'

type Props = {
  elegidos: { id: number; nombre: string; foto: string | null }[]
  formatos: { carrusel: boolean; historia: boolean; reel: boolean; historiaVideo: boolean; videoFeed: boolean }
  fecha: string | null
  ia: DisponibilidadIA
}

const TIPOS: { clave: TipoNueva; nombre: string; icono: string; detalle: string }[] = [
  { clave: 'nutriofertas', nombre: 'NutriOfertas', icono: 'local_offer', detalle: 'Productos con precio rebajado. Estilo ondas, naranja.' },
  { clave: 'lanzamiento', nombre: 'Lanzamiento', icono: 'eco', detalle: 'Productos nuevos o destacados. Estilo orgánico, sin precio.' },
  { clave: 'receta', nombre: 'Receta', icono: 'restaurant', detalle: 'Ingredientes del catálogo y pasos. Estilo lima, sin precio.' },
  { clave: 'promo', nombre: 'Promo (flyer)', icono: 'sell', detalle: 'Lista de precios con %, cantidades y vigencia.' },
  { clave: 'destacado', nombre: 'Producto destacado', icono: 'star', detalle: 'Un solo producto, grande, con su precio.' },
  { clave: 'fecha', nombre: 'Fecha especial', icono: 'celebration', detalle: 'Para la próxima fecha especial de Argentina.' },
]

type Formato = { clave: string; nombre: string; detalle: string; icono: string; ancho: number }
const FORMATOS_CARRUSEL: Formato[] = [
  { clave: 'carrusel', nombre: 'Carrusel', detalle: 'Feed · imágenes 1080×1350', icono: 'view_carousel', ancho: 64 },
  { clave: 'historia', nombre: 'Historia', detalle: 'Imagen 1080×1920', icono: 'image', ancho: 45 },
  { clave: 'reel', nombre: 'Reel', detalle: 'Video animado 9:16', icono: 'movie', ancho: 45 },
  { clave: 'historiaVideo', nombre: 'Historia en video', detalle: 'Animada 9:16 · 8 s', icono: 'slow_motion_video', ancho: 45 },
  { clave: 'videoFeed', nombre: 'Video de feed', detalle: 'Animado 4:5', icono: 'smart_display', ancho: 64 },
]
const FORMATOS_PROMO: Formato[] = [
  { clave: 'historia', nombre: 'Historia', detalle: 'Flyer 1080×1920', icono: 'image', ancho: 45 },
  { clave: 'feed', nombre: 'Feed', detalle: 'Flyer 1080×1350', icono: 'view_carousel', ancho: 64 },
  { clave: 'uno', nombre: 'Uno por producto', detalle: '1080×1350 cada uno', icono: 'grid_view', ancho: 64 },
  { clave: 'reel', nombre: 'Reel', detalle: 'Video animado 9:16', icono: 'movie', ancho: 45 },
  { clave: 'historiaVideo', nombre: 'Historia en video', detalle: 'Animada 9:16 · 8 s', icono: 'slow_motion_video', ancho: 45 },
  { clave: 'videoFeed', nombre: 'Video de feed', detalle: 'Animado 4:5', icono: 'smart_display', ancho: 64 },
]

export function Asistente({ elegidos, formatos, fecha, ia }: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoNueva>('nutriofertas')
  const [fc, setFc] = useState<Record<string, boolean>>({ ...formatos })
  const [fp, setFp] = useState<Record<string, boolean>>({ historia: true, feed: true, uno: false, reel: formatos.reel, historiaVideo: formatos.historiaVideo, videoFeed: formatos.videoFeed })
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const [pensando, empezarIA] = useTransition()
  const esPromo = tipo === 'promo'
  const lista = esPromo ? FORMATOS_PROMO : FORMATOS_CARRUSEL
  const valores = esPromo ? fp : fc
  const setValor = (k: string, v: boolean) => (esPromo ? setFp((x) => ({ ...x, [k]: v })) : setFc((x) => ({ ...x, [k]: v })))
  const marcados = lista.filter((f) => valores[f.clave])
  const nombres = marcados.map((f) => f.nombre.toLowerCase())
  const textoCrear = nombres.length ? `Crear ${nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0]}` : 'Elegí al menos un formato'

  return (
    <>
      <Link href="/creacion/videos" className="aviso aviso-verde asistente-video-propio">
        <Icono nombre="videocam" />
        <span><b>¿Filmaste un video?</b> Subilo en «Mis videos» y le ponemos la marca encima: apertura, franjas con precio y cierre con QR.</span>
        <Icono nombre="chevron_right" />
      </Link>
      <section className="tarjeta asistente-paso">
        <div className="paso-titulo"><span className="paso-num">1</span><h2 className="titulo-seccion">¿Qué querés comunicar?</h2></div>
        <div className="asistente-tipos" role="radiogroup" aria-label="Tipo de pieza">
          {TIPOS.map((t) => (
            <button key={t.clave} type="button" role="radio" aria-checked={tipo === t.clave} className={`asistente-tipo ${tipo === t.clave ? 'asistente-tipo-activo' : ''}`} onClick={() => setTipo(t.clave)}>
              <b><Icono nombre={t.icono} />{t.nombre}</b>
              <small>{t.clave === 'fecha' && fecha ? `Próxima: ${fecha}.` : t.detalle}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta asistente-paso">
        <div className="paso-titulo"><span className="paso-num">2</span><h2 className="titulo-seccion">¿Dónde sale? Elegí uno o varios: se arman todos con el mismo contenido</h2></div>
        <div className="asistente-formatos">
          {lista.map((f) => (
            <label key={f.clave} className={`asistente-formato ${valores[f.clave] ? 'asistente-formato-activo' : ''}`}>
              <span className="asistente-caja" style={{ width: f.ancho }}><Icono nombre={f.icono} tamano={24} /></span>
              <b>{f.nombre}</b>
              <small>{f.detalle}</small>
              <input type="checkbox" checked={!!valores[f.clave]} onChange={(e) => setValor(f.clave, e.target.checked)} />
            </label>
          ))}
        </div>
      </section>

      <section className="tarjeta asistente-paso">
        <div className="paso-titulo"><span className="paso-num">3</span><h2 className="titulo-seccion">¿Qué productos?</h2></div>
        {elegidos.length ? (
          <div className="asistente-elegidos">
            {elegidos.map((e) => (
              <span key={e.id} className="chip chip-producto">
                {e.foto ? <img src={e.foto} alt="" /> : <Icono nombre="image_not_supported" tamano={16} />}
                {e.nombre}
                <button type="button" aria-label={`Sacar ${e.nombre}`} onClick={() => empezar(async () => { await sacarElegido(e.id); router.refresh() })}><Icono nombre="close" tamano={14} /></button>
              </span>
            ))}
          </div>
        ) : (
          <p className="texto-suave">Todavía no elegiste productos. Marcalos con las casillas del catálogo o pedile a la IA que elija.</p>
        )}
        <div className="fila-chips">
          <Link className="btn btn-chico" href="/catalogo"><Icono nombre="inventory_2" tamano={16} />Elegir en el catálogo</Link>
          <button type="button" className="btn btn-chico boton-ia" disabled={!ia.disponible || pensando} title={ia.motivo ?? ''} onClick={() => empezarIA(async () => {
            setError(null)
            const r = await elegirConIA(tipo === 'destacado' ? 1 : tipo === 'receta' ? 4 : 4)
            if ('error' in r) setError(r.error)
            router.refresh()
          })}>
            <Icono nombre={pensando ? 'sync' : 'auto_awesome'} tamano={16} className={pensando ? 'girando' : ''} />{pensando ? 'Pensando…' : 'Que la IA elija'}
            {!pensando && ia.disponible && <small className="costo-ia">{ia.costo}</small>}
          </button>
          {tipo === 'destacado' && elegidos.length > 1 && <span className="texto-chico">Se usa el primero: {elegidos[0].nombre}.</span>}
        </div>
        <button type="button" className="btn btn-pri boton-izquierda" disabled={pendiente || !marcados.length || (!elegidos.length && !esPromo)} onClick={() => empezar(async () => {
          setError(null)
          const r = await crearDesdeAsistente(tipo, valores)
          if (r && 'error' in r) setError(r.error)
        })}><Icono nombre={pendiente ? 'sync' : 'arrow_forward'} className={pendiente ? 'girando' : ''} />{pendiente ? 'Creando…' : textoCrear}</button>
        {error && <span className="texto-error" role="alert">{error}</span>}
      </section>
    </>
  )
}
