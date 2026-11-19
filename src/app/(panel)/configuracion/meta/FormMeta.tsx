'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import type { Config } from '@/lib/configuracion-tipos'
import { MINUTOS_ENTRE_REINTENTOS } from '@/lib/configuracion-tipos'
import type { CuentasMeta, EstadoMeta } from '@/lib/meta/conexion'
import { Campo, Interruptor, useGuardar } from '../Formularios'
import { borrarTokenMeta, cuotaMeta, elegirPaginaMeta, guardarTokenMeta, probarConexionMeta, type Prueba } from '../acciones-meta'

const textoReintentos = (n: number) => (n === 0 ? 'No reintentar' : `${n} ${n === 1 ? 'vez' : 'veces'} en ${n * MINUTOS_ENTRE_REINTENTOS} minutos`)

export function FormMeta({ inicial, estado }: { inicial: Config['meta']; estado: EstadoMeta }) {
  const [v, setV] = useState(inicial)
  const set = <K extends keyof Config['meta']>(k: K, x: Config['meta'][K]) => setV((p) => ({ ...p, [k]: x }))
  const alPublicar = useGuardar('meta'), avanzado = useGuardar('meta')
  const destino = (grupo: 'feed' | 'historia', red: 'instagram' | 'facebook', x: boolean) => set('destinos', { ...v.destinos, [grupo]: { ...v.destinos[grupo], [red]: x } })
  return (
    <>
      <div className="grilla-config">
        <section className="tarjeta">
          <h2 className="titulo-seccion">Conexión con Meta</h2>
          <Conexion estado={estado} />
        </section>

        <section className="tarjeta">
          <h2 className="titulo-seccion">Al publicar</h2>
          <div className="campo">
            <span className="rotulo-columna">Marcado de entrada en «Publicar»</span>
            <div className="destinos-config">
              <span />
              <span className="texto-chico">Instagram</span>
              <span className="texto-chico">Facebook</span>
              <span>Feed (carruseles y promos)</span>
              <input type="checkbox" aria-label="Feed en Instagram" checked={v.destinos.feed.instagram} onChange={(e) => destino('feed', 'instagram', e.target.checked)} />
              <input type="checkbox" aria-label="Feed en Facebook" checked={v.destinos.feed.facebook} onChange={(e) => destino('feed', 'facebook', e.target.checked)} />
              <span>Historias</span>
              <input type="checkbox" aria-label="Historias en Instagram" checked={v.destinos.historia.instagram} onChange={(e) => destino('historia', 'instagram', e.target.checked)} />
              <input type="checkbox" aria-label="Historias en Facebook" checked={v.destinos.historia.facebook} onChange={(e) => destino('historia', 'facebook', e.target.checked)} />
            </div>
          </div>
          <div className="form-columnas">
            <Campo rotulo="Hora sugerida del feed"><input className="input" type="time" value={v.horaFeed} onChange={(e) => set('horaFeed', e.target.value)} /></Campo>
            <Campo rotulo="Hora sugerida de las historias"><input className="input" type="time" value={v.horaHistoria} onChange={(e) => set('horaHistoria', e.target.value)} /></Campo>
          </div>
          <Campo rotulo="Si Meta falla" ayuda="Solo se repite lo que falló: lo que ya salió nunca se publica dos veces.">
            <select className="input" value={v.reintentos} onChange={(e) => set('reintentos', Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{textoReintentos(n)}</option>)}
            </select>
          </Campo>
          <Interruptor valor={v.textoAlt} alCambiar={(x) => set('textoAlt', x)} texto={<><b>Texto alternativo automático</b><span className="texto-chico"> Describe la imagen con los productos, para personas que usan lector de pantalla.</span></>} />
          {alPublicar.pie(() => alPublicar.guardar({ destinos: v.destinos, horaFeed: v.horaFeed, horaHistoria: v.horaHistoria, reintentos: v.reintentos, textoAlt: v.textoAlt }))}
        </section>
      </div>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Avanzado</h2>
        <div className="form-columnas">
          <Campo rotulo="Dirección pública de la plataforma" ayuda="Meta descarga las imágenes desde acá: tiene que abrir desde cualquier lado.">
            <input className="input" value={v.urlPublica} onChange={(e) => set('urlPublica', e.target.value)} />
          </Campo>
          <Campo rotulo="Versión de la API de Meta" ayuda="Cambiala solo si Meta avisa que la versión dejó de funcionar.">
            <input className="input" value={v.versionApi} onChange={(e) => set('versionApi', e.target.value)} />
          </Campo>
        </div>
        <p className="texto-chico">Política de privacidad para la app de Meta (la pide para pasarla a modo «Activo»): <b>{v.urlPublica}/privacidad</b></p>
        {avanzado.pie(() => avanzado.guardar({ urlPublica: v.urlPublica, versionApi: v.versionApi }, (c) => setV((p) => ({ ...p, urlPublica: c.meta.urlPublica, versionApi: c.meta.versionApi }))))}
      </section>
    </>
  )
}

function Conexion({ estado }: { estado: EstadoMeta }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(!estado.conectada)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pruebas, setPruebas] = useState<Prueba[] | null>(null)
  const [cuentas, setCuentas] = useState<CuentasMeta | null>(estado.cuentas)
  const [cuota, setCuota] = useState<{ usadas: number; total: number } | null>(null)
  const [pendiente, empezar] = useTransition()
  const [probando, empezarPrueba] = useTransition()

  useEffect(() => setCuentas(estado.cuentas), [estado.cuentas])
  // El cupo del día se pide a Meta al abrir la pantalla (sin frenar la carga)
  useEffect(() => {
    if (estado.conectada) void cuotaMeta().then(setCuota).catch(() => null)
  }, [estado.conectada])

  return (
    <div className="campo">
      {estado.conectada && cuentas ? (
        <>
          <div className="fila-chips">
            <span className="chip chip-ok"><Icono nombre="check_circle" tamano={14} /> Conectada</span>
            <span className="texto-suave">Token terminado en ···{estado.finToken} · {cuentas.vence ? `vence el ${new Date(cuentas.vence).toLocaleDateString('es-AR')}` : 'no vence'}</span>
            <button type="button" className="btn btn-chico" onClick={() => setAbierto(!abierto)}>{abierto ? 'Cancelar' : 'Cambiar token'}</button>
            <button type="button" className="enlace texto-chico" onClick={() => { if (confirm('¿Desconectar Meta? Lo programado no va a poder salir hasta que cargues otro token.')) empezar(async () => { await borrarTokenMeta(); router.refresh() }) }}>Desconectar</button>
          </div>
          <div className="cuenta-meta">
            <Icono nombre="flag" />
            <div>
              <b>Página de Facebook</b>
              {cuentas.paginas.length > 1 ? (
                <select className="input" value={cuentas.paginaId} aria-label="Página" onChange={(e) => empezar(async () => { const r = await elegirPaginaMeta(e.target.value); if ('error' in r) setError(r.error); else { setCuentas(r.cuentas); router.refresh() } })}>
                  {cuentas.paginas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.instagramUsuario ? ` · @${p.instagramUsuario}` : ''}</option>)}
                </select>
              ) : (
                <div className="texto-chico">{cuentas.paginaNombre} · se detectó sola</div>
              )}
            </div>
          </div>
          <div className={`cuenta-meta ${cuentas.instagramId ? '' : 'cuenta-meta-falta'}`}>
            <Icono nombre="photo_camera" />
            <div>
              <b>Instagram de empresa</b>
              <div className="texto-chico">{cuentas.instagramId ? `@${cuentas.instagramUsuario ?? cuentas.instagramId} · vinculado a la página` : 'La página no tiene un Instagram de empresa vinculado: vinculalo en Meta Business Suite y tocá «Probar conexión».'}</div>
            </div>
          </div>
          {cuentas.faltan.length > 0 && <p className="texto-error">Al token le faltan permisos: {cuentas.faltan.join(', ')}. Generalo de nuevo marcándolos.</p>}
          <div className="fila-chips">
            <button type="button" className="btn btn-chico" disabled={probando} onClick={() => empezarPrueba(async () => {
              setError(null)
              const r = await probarConexionMeta()
              if ('error' in r) setError(r.error)
              else { setPruebas(r.pruebas); if (r.cuentas) setCuentas(r.cuentas) }
            })}><Icono nombre={probando ? 'sync' : 'wifi_tethering'} tamano={16} className={probando ? 'girando' : ''} />{probando ? 'Probando…' : 'Probar conexión'}</button>
            {cuota && <span className="texto-chico">Hoy: {cuota.usadas} de {cuota.total} publicaciones en Instagram.</span>}
          </div>
          {pruebas && (
            <ul className="lista-pruebas">
              {pruebas.map((p, i) => <li key={i} className={p.ok ? '' : 'prueba-mal'}><Icono nombre={p.ok ? 'check_circle' : 'error'} tamano={18} />{p.texto}</li>)}
            </ul>
          )}
          <p className="texto-chico">Antes de publicar, te recomendamos un PIN de 6 a 8 dígitos: <Link href="/configuracion/seguridad">cambialo en Seguridad</Link>.</p>
        </>
      ) : (
        <p className="texto-suave">
          Pegá el token del <b>usuario del sistema</b> de tu portafolio comercial (business.facebook.com › Configuración del negocio › Usuarios del sistema › Generar token, con vencimiento «Nunca»).
          Se prueba antes de guardar, queda cifrado y la página y el Instagram se detectan solos. Nunca lo mandes por chat ni por mail.
        </p>
      )}
      {abierto && (
        <div className="fila-campo">
          <input className="input" type="password" autoComplete="off" placeholder="EAA…" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token de Meta" />
          <button type="button" className="btn btn-pri" disabled={pendiente || !token.trim()} onClick={() => empezar(async () => {
            setError(null)
            const r = await guardarTokenMeta(token)
            if ('error' in r) setError(r.error)
            else { setToken(''); setAbierto(false); setCuentas(r.cuentas); router.refresh() }
          })}>{pendiente ? 'Probando…' : 'Probar y guardar'}</button>
        </div>
      )}
      {error && <span className="texto-error" role="alert">{error}</span>}
    </div>
  )
}
