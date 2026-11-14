import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { NOMBRE_ESTADO } from '@/lib/catalogo/etiquetas-cambios'
import { duracion, fechaHora, numero } from '@/lib/formato'

export default async function Sincronizaciones() {
  const filas = await db.select().from(esquema.sincronizaciones).orderBy(desc(esquema.sincronizaciones.id)).limit(200)
  return (
    <>
      <div>
        <h2 className="titulo-seccion">Sincronizaciones</h2>
        <p className="texto-suave">Cada vez que se apretó «Sincronizar ahora». Se guardan los últimos 6 meses.</p>
      </div>
      {filas.length === 0 ? (
        <div className="vacio vacio-chico"><p>Todavía no se sincronizó nunca.</p></div>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla-clic">
            <thead>
              <tr><th>Fecha</th><th>Estado</th><th className="num">Nuevos</th><th className="num">Cambiados</th><th className="num">Precios</th><th className="num">Bajas</th><th className="num">Fotos copiadas</th><th className="num">Duración</th></tr>
            </thead>
            <tbody>
              {filas.map((s) => {
                const r = s.resumen
                const href = `/catalogo/sincronizaciones/${s.id}`
                return (
                  <tr key={s.id}>
                    <td><Link href={href} className="fila-enlace">{fechaHora(s.creadoEn)}</Link></td>
                    <td><span className={`chip chip-${s.estado}`}>{NOMBRE_ESTADO[s.estado] ?? s.estado}</span></td>
                    <td className="num">{r ? numero(r.altas) : '—'}</td>
                    <td className="num">{r ? numero(r.modificados) : '—'}</td>
                    <td className="num">{r ? numero(r.precios) : '—'}</td>
                    <td className="num">{r ? numero(r.bajas) : '—'}</td>
                    <td className="num">{r ? numero(r.fotosDescargadas) : '—'}</td>
                    <td className="num">{s.iniciadaEn && s.terminadaEn ? duracion(s.iniciadaEn, s.terminadaEn) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
