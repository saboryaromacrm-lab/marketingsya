'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { excluirFiltrados } from '@/app/(panel)/catalogo/acciones'

const numero = (n: number) => n.toLocaleString('es-AR')

// «No usar en piezas los N filtrados», con confirmación. Sirve para sacar de una vez,
// por ejemplo, toda la subcategoría Gaseosas.
export function AccionMasiva({ consulta, total, soloExcluidos }: { consulta: string; total: number; soloExcluidos: boolean }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [mensaje, setMensaje] = useState<string | null>(null)

  function aplicar(excluir: boolean) {
    const texto = excluir
      ? `¿Sacar de las piezas los ${numero(total)} productos filtrados?`
      : `¿Volver a usar en piezas los ${numero(total)} productos filtrados?`
    if (!window.confirm(texto)) return
    empezar(async () => {
      const r = await excluirFiltrados(consulta, excluir)
      setMensaje(`Listo: ${numero(r.cambiados)} ${r.cambiados === 1 ? 'producto' : 'productos'} ${excluir ? 'ya no van' : 'vuelven a ir'} en piezas.`)
      router.refresh()
    })
  }

  return (
    <div className="accion-masiva">
      <span className="texto-suave">Con los {numero(total)} filtrados:</span>
      {!soloExcluidos && (
        <button className="btn btn-chico" onClick={() => aplicar(true)} disabled={pendiente}>
          <Icono nombre="block" tamano={16} /> Sacar de las piezas
        </button>
      )}
      <button className="btn btn-chico" onClick={() => aplicar(false)} disabled={pendiente}>
        <Icono nombre="check_circle" tamano={16} /> Volver a usar en piezas
      </button>
      {mensaje && <span className="texto-ok" role="status">{mensaje}</span>}
    </div>
  )
}
