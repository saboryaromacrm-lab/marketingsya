'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { subirFoto } from './subirFoto'

// Foto grande del producto: la propia (si hay) o la del ERP, con miniaturas para comparar.
// Desde el celular, «Sacar foto» abre directo la cámara.
export function FotoProducto({ productoId, propia, erp, nombre }: { productoId: number; propia: string | null; erp: string | null; nombre: string }) {
  const router = useRouter()
  const archivo = useRef<HTMLInputElement>(null)
  const camara = useRef<HTMLInputElement>(null)
  const [vista, setVista] = useState<'propia' | 'erp'>(propia ? 'propia' : 'erp')
  const [avance, setAvance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quitando, setQuitando] = useState(false)

  const mostrada = vista === 'propia' ? propia : erp

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setError(null)
    setAvance(0)
    try {
      await subirFoto(productoId, f, setAvance)
      setVista('propia')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir.')
    } finally {
      setAvance(null)
    }
  }

  async function quitar() {
    if (!window.confirm('¿Quitar tu foto? El producto vuelve a usar la del ERP' + (erp ? '.' : ' (no tiene, quedaría sin foto).'))) return
    setQuitando(true)
    setError(null)
    const res = await fetch(`/api/productos/${productoId}/foto`, { method: 'DELETE' })
    setQuitando(false)
    if (!res.ok) return setError('No se pudo quitar la foto.')
    setVista('erp')
    router.refresh()
  }

  return (
    <section className="tarjeta foto-producto">
      <div className={`foto-grande ${mostrada ? '' : 'foto-grande-vacia'}`}>
        {mostrada ? <img src={mostrada} alt={nombre} /> : (
          <div className="texto-suave"><Icono nombre="no_photography" tamano={40} /><p>Sin foto</p></div>
        )}
        {avance !== null && (
          <div className="foto-subiendo" role="status">
            <Icono nombre="cloud_upload" tamano={28} />
            <span>{avance < 100 ? `Subiendo ${avance}%` : 'Procesando…'}</span>
            <div className="progreso-barra-local"><div style={{ width: `${avance}%` }} /></div>
          </div>
        )}
      </div>

      {(propia || erp) && (
        <div className="foto-opciones">
          {propia && (
            <button className={`foto-opcion ${vista === 'propia' ? 'foto-opcion-activa' : ''}`} onClick={() => setVista('propia')}>
              <img src={propia} alt="" /> <span>Tu foto <small>se usa en las piezas</small></span>
            </button>
          )}
          {erp && (
            <button className={`foto-opcion ${vista === 'erp' ? 'foto-opcion-activa' : ''}`} onClick={() => setVista('erp')}>
              <img src={erp} alt="" /> <span>Del ERP {!propia && <small>se usa en las piezas</small>}</span>
            </button>
          )}
        </div>
      )}

      {error && <p className="texto-error" role="alert">{error}</p>}

      <div className="foto-acciones">
        <button className="btn btn-pri" onClick={() => archivo.current?.click()} disabled={avance !== null}>
          <Icono nombre="upload" /> {propia ? 'Cambiar foto' : 'Subir foto'}
        </button>
        <button className="btn solo-tactil" onClick={() => camara.current?.click()} disabled={avance !== null}>
          <Icono nombre="photo_camera" /> Sacar foto
        </button>
        {propia && (
          <button className="btn" onClick={quitar} disabled={quitando || avance !== null}>
            <Icono nombre="delete" /> Quitar mi foto
          </button>
        )}
      </div>
      <p className="texto-chico">JPG, PNG o WebP de hasta 20 MB. Se guarda una versión cuadrada con fondo blanco para las piezas.</p>
      <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={elegir} />
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={elegir} />
    </section>
  )
}
