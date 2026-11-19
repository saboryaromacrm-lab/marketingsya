import { desc } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { entorno } from '@/lib/entorno'
import { CambiarClave } from '../CambiarClave'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Seguridad' }

const fecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Cordoba' })

export default async function Seguridad() {
  const intentos = await db.select().from(esquema.intentosIngreso).orderBy(desc(esquema.intentosIngreso.creadoEn)).limit(10)
  return (
    <>
      <section className="tarjeta">
        <h2 className="titulo-seccion">PIN de ingreso</h2>
        <CambiarClave />
        <p className="texto-chico">
          La sesión dura {entorno.sesionDias} días en cada dispositivo. ¿Te olvidaste el PIN? En Dokploy poné la variable
          <code>REINICIAR_CLAVE=si</code>, volvé a publicar y entrá: te va a pedir crear uno nuevo con el código de instalación. Después sacá esa variable.
        </p>
      </section>
      <section className="tarjeta">
        <h2 className="titulo-seccion">Últimos ingresos</h2>
        <div className="tabla-marco">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Resultado</th><th>IP</th><th>Navegador</th></tr></thead>
            <tbody>
              {intentos.map((i) => (
                <tr key={i.id}>
                  <td>{fecha.format(i.creadoEn)}</td>
                  <td><span className={`chip ${i.exitoso ? '' : 'chip-rojo'}`}>{i.exitoso ? 'Ingresó' : 'PIN incorrecto'}</span></td>
                  <td>{i.ip}</td>
                  <td className="texto-suave celda-corta">{i.navegador}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
