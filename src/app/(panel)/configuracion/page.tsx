import { desc } from 'drizzle-orm'
import { Cabecera } from '@/components/Cabecera'
import { db, esquema } from '@/lib/db'
import { entorno } from '@/lib/entorno'

export const dynamic = 'force-dynamic'

const fecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Cordoba' })

export default async function Configuracion() {
  const intentos = await db.select().from(esquema.intentosIngreso).orderBy(desc(esquema.intentosIngreso.creadoEn)).limit(10)
  return (
    <div className="contenido">
      <Cabecera titulo="Configuración" subtitulo="Acceso y seguridad de la plataforma." miga={[{ texto: 'Configuración' }]} />
      <section className="tarjeta">
        <h2 className="titulo-seccion">Sesión</h2>
        <p className="texto-suave">La sesión dura {entorno.sesionDias} días en cada dispositivo. Para cerrar todas a la vez, cambiá SESION_SECRETO en Dokploy.</p>
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
                  <td><span className={`chip ${i.exitoso ? '' : 'chip-rojo'}`}>{i.exitoso ? 'Ingresó' : 'Contraseña incorrecta'}</span></td>
                  <td>{i.ip}</td>
                  <td className="texto-suave celda-corta">{i.navegador}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
