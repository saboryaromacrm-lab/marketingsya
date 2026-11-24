import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import { NOMBRE_CAMBIO, NOMBRE_ESTADO } from '@/lib/catalogo/etiquetas-cambios'
import { urlMedia } from '@/lib/media'
import { duracion, fechaHora, numero } from '@/lib/formato'
import { soloDistintos, ValorCambio as Valor } from '@/components/catalogo/ValorCambio'

const POR_PAGINA = 100
const { sincronizaciones, sincronizacionCambios, productos, marcas } = esquema

export default async function DetalleSincronizacion({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tipo?: string; pagina?: string }>
}) {
  const id = Number((await params).id)
  const { tipo, pagina: paginaTexto } = await searchParams
  if (!Number.isInteger(id)) notFound()
  const [s] = await db.select().from(sincronizaciones).where(eq(sincronizaciones.id, id))
  if (!s) notFound()

  const conteos = await db
    .select({ tipo: sincronizacionCambios.tipo, n: sql<number>`count(*)::int` })
    .from(sincronizacionCambios)
    .where(eq(sincronizacionCambios.sincronizacionId, id))
    .groupBy(sincronizacionCambios.tipo)
  const total = conteos.reduce((a, c) => a + c.n, 0)
  const tipoValido = tipo && conteos.some((c) => c.tipo === tipo) ? tipo : undefined
  const cantidad = tipoValido ? conteos.find((c) => c.tipo === tipoValido)!.n : total
  const paginas = Math.max(1, Math.ceil(cantidad / POR_PAGINA))
  const pagina = Math.min(paginas, Math.max(1, Number(paginaTexto) || 1))

  const cambios = await db
    .select({
      id: sincronizacionCambios.id, entidad: sincronizacionCambios.entidad, entidadId: sincronizacionCambios.entidadId,
      nombre: sincronizacionCambios.nombre, tipo: sincronizacionCambios.tipo, antes: sincronizacionCambios.antes, despues: sincronizacionCambios.despues,
      foto: productos.imagenArchivo, logo: marcas.logoArchivo,
    })
    .from(sincronizacionCambios)
    .leftJoin(productos, and(eq(sincronizacionCambios.entidad, 'producto'), eq(productos.id, sincronizacionCambios.entidadId)))
    .leftJoin(marcas, and(eq(sincronizacionCambios.entidad, 'marca'), eq(marcas.id, sincronizacionCambios.entidadId)))
    .where(and(eq(sincronizacionCambios.sincronizacionId, id), tipoValido ? eq(sincronizacionCambios.tipo, tipoValido) : undefined))
    .orderBy(asc(sincronizacionCambios.tipo), asc(sincronizacionCambios.nombre))
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA)

  const marcasPorId = new Map((await db.select({ id: marcas.id, nombre: marcas.nombre }).from(marcas)).map((m) => [m.id, m.nombre]))
  const r = s.resumen
  const enlace = (t?: string, p = 1) => {
    const q = new URLSearchParams()
    if (t) q.set('tipo', t)
    if (p > 1) q.set('pagina', String(p))
    const qs = q.toString()
    return `/catalogo/sincronizaciones/${id}${qs ? `?${qs}` : ''}`
  }

  return (
    <>
      <div>
        <Link prefetch={false} href="/catalogo/sincronizaciones" className="volver"><Icono nombre="arrow_back" /> Sincronizaciones</Link>
        <h2 className="titulo-seccion">Sincronización del {fechaHora(s.creadoEn)}</h2>
        <p className="texto-suave">
          <span className={`chip chip-${s.estado}`}>{NOMBRE_ESTADO[s.estado] ?? s.estado}</span>
          {s.iniciadaEn && s.terminadaEn && <> · Tardó {duracion(s.iniciadaEn, s.terminadaEn)}</>}
          {r && <> · {numero(r.productos)} productos en el ERP</>}
          {r && r.fotosDescargadas > 0 && <> · {numero(r.fotosDescargadas)} fotos copiadas</>}
        </p>
      </div>

      {s.estado === 'error' && <Aviso tono="ambar" dato="No se pudo terminar:">{s.error}</Aviso>}
      {r && r.fotosConError > 0 && (
        <Aviso tono="ambar" dato={`${numero(r.fotosConError)} fotos no se pudieron copiar.`}>Se reintentan solas en la próxima sincronización.</Aviso>
      )}
      {s.estado === 'sin_cambios' && <Aviso tono="verde" dato="El catálogo ya estaba al día:">no cambió nada desde la sincronización anterior.</Aviso>}

      {total > 0 && (
        <>
          <nav className="pestanas" aria-label="Tipo de cambio">
            <Link prefetch={false} href={enlace()} className={!tipoValido ? 'pestana-activa' : ''}>Todos ({numero(total)})</Link>
            {conteos.map((c) => (
              <Link prefetch={false} key={c.tipo} href={enlace(c.tipo)} className={tipoValido === c.tipo ? 'pestana-activa' : ''}>
                {NOMBRE_CAMBIO[c.tipo] ?? c.tipo} ({numero(c.n)})
              </Link>
            ))}
          </nav>
          <div className="tabla-marco">
            <table className="tabla">
              <thead><tr><th>Foto</th><th>Producto o marca</th><th>Qué cambió</th><th>Antes</th><th>Después</th></tr></thead>
              <tbody>
                {cambios.map((c) => {
                  const archivo = c.entidad === 'producto' ? c.foto : c.logo
                  const [antes, despues] = c.tipo === 'datos' ? soloDistintos(c.antes, c.despues) : [c.antes, c.despues]
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className={`miniatura ${archivo ? '' : 'miniatura-vacia'}`}>
                          {archivo ? <img src={urlMedia(archivo)} alt="" loading="lazy" /> : <Icono nombre={c.entidad === 'marca' ? 'sell' : 'no_photography'} />}
                        </div>
                      </td>
                      <td>
                        <div className="nombre-producto">{c.nombre}</div>
                        <div className="texto-chico">{c.entidad === 'marca' ? 'Marca' : `ID ${c.entidadId}`}</div>
                      </td>
                      <td><span className={`chip chip-cambio-${c.tipo}`}>{NOMBRE_CAMBIO[c.tipo] ?? c.tipo}</span></td>
                      <td>{['alta', 'baja', 'reactivado'].includes(c.tipo) ? <span className="texto-suave">—</span> : <Valor tipo={c.tipo} valor={antes} marcasPorId={marcasPorId} />}</td>
                      <td>{['baja', 'reactivado'].includes(c.tipo) ? <span className="texto-suave">—</span> : <Valor tipo={c.tipo} valor={despues} marcasPorId={marcasPorId} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {paginas > 1 && (
              <div className="tabla-pie">
                <span>Mostrando {numero((pagina - 1) * POR_PAGINA + 1)}–{numero(Math.min(pagina * POR_PAGINA, cantidad))} de {numero(cantidad)}</span>
                <span className="tabla-pie-botones">
                  {pagina > 1 ? <Link prefetch={false} className="btn btn-chico" href={enlace(tipoValido, pagina - 1)}>Anterior</Link> : <span className="btn btn-chico" aria-disabled="true">Anterior</span>}
                  {pagina < paginas ? <Link prefetch={false} className="btn btn-chico" href={enlace(tipoValido, pagina + 1)}>Siguiente</Link> : <span className="btn btn-chico" aria-disabled="true">Siguiente</span>}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
