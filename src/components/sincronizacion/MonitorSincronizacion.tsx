'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icono } from '@/components/Icono'
import type { ResumenSincronizacion } from '@/lib/db/esquema'
import { avisarFin, INICIO } from './eventos'

type Estado = { id: number; estado: string; etapa: string | null; avance: number; resumen: ResumenSincronizacion | null; error: string | null }

const numero = (n: number) => n.toLocaleString('es-AR')

// Franja con la barra de avance mientras sincroniza, y aviso arriba a la derecha al terminar.
export function MonitorSincronizacion({ inicial }: { inicial: Estado | null }) {
  const router = useRouter()
  const [actual, setActual] = useState<Estado | null>(inicial)
  const [terminada, setTerminada] = useState<Estado | null>(null)

  useEffect(() => {
    const alIniciar = (e: Event) => {
      const id = (e as CustomEvent<{ id: number }>).detail.id
      setTerminada(null)
      setActual({ id, estado: 'en_cola', etapa: 'Esperando turno', avance: 0, resumen: null, error: null })
    }
    window.addEventListener(INICIO, alIniciar)
    return () => window.removeEventListener(INICIO, alIniciar)
  }, [])

  const id = actual?.id
  useEffect(() => {
    if (!id) return
    let vivo = true
    const consultar = async () => {
      try {
        const res = await fetch(`/api/sincronizaciones/${id}`, { cache: 'no-store' })
        if (!res.ok || !vivo) return
        const s: Estado = await res.json()
        if (s.estado === 'en_cola' || s.estado === 'corriendo') setActual(s)
        else {
          setActual(null)
          setTerminada(s)
          avisarFin()
          router.refresh()
        }
      } catch {
        // sin conexión un momento: se reintenta en el próximo ciclo
      }
    }
    const t = setInterval(consultar, 1000)
    consultar()
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [id, router])

  // El aviso de fin se va solo a los 20 segundos
  useEffect(() => {
    if (!terminada) return
    const t = setTimeout(() => setTerminada(null), 20_000)
    return () => clearTimeout(t)
  }, [terminada])

  return (
    <>
      {actual && (
        <div className="franja franja-neutro progreso" role="status">
          <span aria-hidden="true">🔄</span> <b>Sincronizando el catálogo:</b> {actual.etapa ?? 'Esperando turno'}
          <span className="progreso-numero">{actual.avance}%</span>
          <div className="progreso-barra"><div style={{ width: `${actual.avance}%` }} /></div>
        </div>
      )}
      {terminada && <AvisoFin s={terminada} cerrar={() => setTerminada(null)} />}
    </>
  )
}

function AvisoFin({ s, cerrar }: { s: Estado; cerrar: () => void }) {
  const r = s.resumen
  const cambios = r ? r.altas + r.bajas + r.reactivados + r.modificados + r.marcas : 0
  let icono = 'check_circle'
  let texto: string
  if (s.estado === 'error') {
    icono = 'error'
    texto = `No se pudo sincronizar: ${s.error ?? 'error desconocido'}`
  } else if (s.estado === 'sin_cambios') {
    texto = `El catálogo ya estaba al día · ${numero(r?.productos ?? 0)} productos`
  } else {
    texto = `Sincronización terminada · ${numero(r?.productos ?? 0)} productos, ${numero(cambios)} ${cambios === 1 ? 'cambio' : 'cambios'}`
  }
  const fotosConError = r?.fotosConError ?? 0
  const fotosCopiadas = r?.fotosDescargadas ?? 0
  return (
    <div className={`toast ${s.estado === 'error' ? 'toast-error' : ''}`} role="alert">
      <Icono nombre={icono} />
      <span>
        {texto}
        {s.estado !== 'error' && fotosCopiadas > 0 && ` · ${numero(fotosCopiadas)} fotos copiadas`}
        {fotosConError > 0 && ` · ${numero(fotosConError)} fotos no se pudieron copiar`}
      </span>
      <Link prefetch={false} href={`/catalogo/sincronizaciones/${s.id}`} onClick={cerrar}>Ver {s.estado === 'error' ? 'detalle' : 'cambios'}</Link>
      <button onClick={cerrar} aria-label="Cerrar"><Icono nombre="close" /></button>
    </div>
  )
}
