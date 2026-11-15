'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { Logo } from '@/components/Logo'

export function SubirLogo({ actual }: { actual: string | null }) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(metodo: 'POST' | 'DELETE', archivo?: File) {
    setError(null)
    setOcupado(true)
    const datos = new FormData()
    if (archivo) datos.append('logo', archivo)
    const res = await fetch('/api/ajustes/logo', { method: metodo, body: archivo ? datos : undefined })
    setOcupado(false)
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? 'No se pudo guardar.')
    router.refresh()
  }

  return (
    <div className="fila-logo">
      <div className="logo-muestra"><Logo tamano={72} src={actual} /></div>
      <div className="campo">
        <p className="texto-suave">Se ve en la barra lateral y en la pantalla de ingreso. Usá el logo circular en PNG o SVG con fondo transparente; no se recorta ni se deforma.</p>
        <div className="foto-acciones">
          <button className="btn btn-pri" onClick={() => entrada.current?.click()} disabled={ocupado}><Icono nombre="upload" /> {actual ? 'Cambiar logo' : 'Subir logo'}</button>
          {actual && <button className="btn" onClick={() => enviar('DELETE')} disabled={ocupado}><Icono nombre="delete" /> Quitar</button>}
        </div>
        {error && <p className="texto-error" role="alert">{error}</p>}
      </div>
      <input ref={entrada} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviar('POST', f) }} />
    </div>
  )
}
