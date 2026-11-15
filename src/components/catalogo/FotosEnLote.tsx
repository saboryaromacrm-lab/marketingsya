'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { emparejarFotos, type ResultadoEmparejado } from '@/app/(panel)/catalogo/acciones'
import { subirFoto, TAMANO_MAXIMO } from './subirFoto'

const MAXIMO_ARCHIVOS = 300
const EN_PARALELO = 2
const numero = (n: number) => n.toLocaleString('es-AR')

type Fila = ResultadoEmparejado & {
  archivoReal: File
  vistaPrevia: string
  incluir: boolean
  estadoSubida?: 'esperando' | 'subiendo' | 'ok' | 'error'
  avance?: number
  error?: string
}

function motivo(f: Fila): string | null {
  if (f.archivoReal.size > TAMANO_MAXIMO) return 'Pesa más de 20 MB.'
  if (f.estado === 'sin-coincidencia') return 'Ningún producto tiene ese código.'
  if (f.estado === 'ambiguo') return `Ese código lo tienen ${f.candidatos.length} productos (IDs ${f.candidatos.join(', ')}). Renombrala con el ID.`
  if (f.estado === 'repetido') return 'Ya hay otra foto para este producto en esta tanda.'
  return null
}

export function FotosEnLote() {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [revisando, setRevisando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // Libera las vistas previas al salir
  useEffect(() => () => filas.forEach((f) => URL.revokeObjectURL(f.vistaPrevia)), [filas])

  async function elegir(lista: FileList | File[]) {
    const archivos = [...lista].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    setAviso(archivos.length > MAXIMO_ARCHIVOS ? `Se toman las primeras ${MAXIMO_ARCHIVOS} fotos; subí el resto en otra tanda.` : null)
    const tanda = archivos.slice(0, MAXIMO_ARCHIVOS)
    if (!tanda.length) return
    setRevisando(true)
    const resultado = await emparejarFotos(tanda.map((f) => f.name))
    setFilas(
      resultado.map((r, i) => {
        const f: Fila = { ...r, archivoReal: tanda[i], vistaPrevia: URL.createObjectURL(tanda[i]), incluir: false }
        f.incluir = !motivo(f) && !f.producto?.dadoDeBaja
        return f
      }),
    )
    setRevisando(false)
  }

  async function subir() {
    setSubiendo(true)
    const pendientes = filas.map((f, i) => (f.incluir && f.producto && f.estadoSubida !== 'ok' ? i : -1)).filter((i) => i >= 0)
    const actualizar = (i: number, cambios: Partial<Fila>) => setFilas((xs) => xs.map((x, j) => (j === i ? ({ ...x, ...cambios } as Fila) : x)))
    pendientes.forEach((i) => actualizar(i, { estadoSubida: 'esperando', error: undefined }))
    let siguiente = 0
    const trabajador = async () => {
      while (siguiente < pendientes.length) {
        const i = pendientes[siguiente++]
        actualizar(i, { estadoSubida: 'subiendo', avance: 0 })
        try {
          await subirFoto(filas[i].producto!.id, filas[i].archivoReal, (a) => actualizar(i, { avance: a }))
          actualizar(i, { estadoSubida: 'ok' })
        } catch (e) {
          actualizar(i, { estadoSubida: 'error', error: e instanceof Error ? e.message : 'No se pudo subir.' })
        }
      }
    }
    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador))
    setSubiendo(false)
    router.refresh()
  }

  const elegidas = filas.filter((f) => f.incluir && f.producto)
  const hechas = filas.filter((f) => f.estadoSubida === 'ok').length
  const conError = filas.filter((f) => f.estadoSubida === 'error').length
  const reemplazan = elegidas.filter((f) => f.producto?.fotoPropia).length
  const terminado = !subiendo && hechas + conError > 0

  if (!filas.length) {
    return (
      <>
        <div
          className={`zona-soltar ${arrastrando ? 'zona-soltar-activa' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files) }}
        >
          <Icono nombre="add_photo_alternate" tamano={40} />
          <p><b>Arrastrá las fotos acá</b> o</p>
          <button className="btn btn-pri" onClick={() => entrada.current?.click()} disabled={revisando}>
            {revisando ? 'Revisando…' : 'Elegir fotos'}
          </button>
          <p className="texto-chico">Hasta {MAXIMO_ARCHIVOS} por tanda · JPG, PNG o WebP de hasta 20 MB cada una</p>
        </div>
        {aviso && <p className="texto-error">{aviso}</p>}
        <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && elegir(e.target.files)} />
      </>
    )
  }

  return (
    <>
      {aviso && <p className="texto-error">{aviso}</p>}
      <div className={`aviso ${terminado && !conError ? 'aviso-verde' : 'aviso-ambar'}`}>
        <div>
          {terminado ? (
            <><b>{numero(hechas)} {hechas === 1 ? 'foto subida' : 'fotos subidas'}</b>{conError > 0 && <span className="aviso-detalle">, {numero(conError)} con error (podés reintentarlas)</span>}.</>
          ) : (
            <><b>{numero(elegidas.length)} de {numero(filas.length)} fotos listas para subir</b>
              <span className="aviso-detalle">{reemplazan > 0 && ` · ${numero(reemplazan)} reemplazan una foto tuya anterior`}. Revisá abajo a dónde va cada una.</span></>
          )}
        </div>
        <div className="aviso-accion">
          {!terminado || conError > 0 ? (
            <button className="btn btn-pri btn-chico" onClick={subir} disabled={subiendo || elegidas.length === 0}>
              {subiendo ? `Subiendo ${numero(hechas)} de ${numero(elegidas.length)}…` : conError > 0 ? 'Reintentar las que fallaron' : `Subir ${numero(elegidas.length)}`}
            </button>
          ) : (
            <Link className="btn btn-chico" href="/catalogo?foto=sin">Ver los que siguen sin foto</Link>
          )}
          <button className="btn btn-chico" onClick={() => setFilas([])} disabled={subiendo}>Otra tanda</button>
        </div>
      </div>

      <div className="tabla-marco">
        <table className="tabla tabla-lote">
          <thead><tr><th></th><th>Foto</th><th>Archivo</th><th>Va a</th><th>Estado</th></tr></thead>
          <tbody>
            {filas.map((f, i) => {
              const problema = motivo(f)
              return (
                <tr key={i} className={f.incluir ? '' : 'fila-baja'}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Incluir ${f.archivo}`}
                      checked={f.incluir}
                      disabled={!!problema || !f.producto || subiendo || f.estadoSubida === 'ok'}
                      onChange={(e) => setFilas((xs) => xs.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))}
                    />
                  </td>
                  <td><div className="miniatura"><img src={f.vistaPrevia} alt="" /></div></td>
                  <td className="celda-corta" title={f.archivo}>{f.archivo}{f.estado !== 'sin-coincidencia' && <div className="texto-chico">por {f.por}</div>}</td>
                  <td>
                    {f.producto ? (
                      <div className="producto-destino">
                        <div className={`miniatura ${f.producto.foto ? '' : 'miniatura-vacia'}`}>
                          {f.producto.foto ? <img src={`/media/${f.producto.foto}`} alt="" /> : <Icono nombre="no_photography" />}
                        </div>
                        <div>
                          <Link href={`/catalogo/${f.producto.id}`} target="_blank" className="nombre-producto">{f.producto.nombre}</Link>
                          <div className="texto-chico">
                            ID {f.producto.id}
                            {f.producto.fotoPropia && ' · reemplaza tu foto anterior'}
                            {f.producto.dadoDeBaja && ' · dado de baja'}
                          </div>
                        </div>
                      </div>
                    ) : <span className="texto-suave">—</span>}
                  </td>
                  <td className="celda-estado">
                    {f.estadoSubida === 'ok' && <span className="texto-ok"><Icono nombre="check_circle" tamano={16} /> Subida</span>}
                    {f.estadoSubida === 'subiendo' && <span>{(f.avance ?? 0) < 100 ? `Subiendo ${f.avance ?? 0}%` : 'Procesando…'}</span>}
                    {f.estadoSubida === 'esperando' && <span className="texto-suave">En espera</span>}
                    {f.estadoSubida === 'error' && <span className="texto-error">{f.error}</span>}
                    {!f.estadoSubida && (problema ? <span className="texto-error">{problema}</span> : f.producto?.dadoDeBaja ? <span className="texto-suave">Dado de baja: tildalo si igual la querés</span> : <span className="texto-suave">Lista</span>)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
