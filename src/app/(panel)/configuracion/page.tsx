import { desc } from 'drizzle-orm'
import { Cabecera } from '@/components/Cabecera'
import { db, esquema } from '@/lib/db'
import { entorno } from '@/lib/entorno'
import { leerAjuste } from '@/lib/ajustes'
import { LARGO_MINIMO_CLAVE } from '@/lib/auth/clave-guardada'
import { urlMedia } from '@/lib/media'
import { CambiarClave } from './CambiarClave'
import { SubirLogo } from './SubirLogo'
import { ProbarMotor } from './ProbarMotor'

export const dynamic = 'force-dynamic'

const fecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Cordoba' })

export default async function Configuracion() {
  const [intentos, logo] = await Promise.all([
    db.select().from(esquema.intentosIngreso).orderBy(desc(esquema.intentosIngreso.creadoEn)).limit(10),
    leerAjuste('logo'),
  ])
  return (
    <div className="contenido">
      <Cabecera titulo="Configuración" subtitulo="Acceso y seguridad de la plataforma." miga={[{ texto: 'Configuración' }]} />
      <section className="tarjeta">
        <h2 className="titulo-seccion">Logo</h2>
        <SubirLogo actual={logo ? urlMedia(logo) : null} />
      </section>
      <section className="tarjeta">
        <h2 className="titulo-seccion">Motor de piezas</h2>
        <ProbarMotor />
      </section>
      <section className="tarjeta">
        <h2 className="titulo-seccion">Contraseña</h2>
        <CambiarClave largoMinimo={LARGO_MINIMO_CLAVE} />
        <p className="texto-chico">
          La sesión dura {entorno.sesionDias} días en cada dispositivo. ¿Te olvidaste la contraseña? En Dokploy poné la variable
          <code>REINICIAR_CLAVE=si</code>, volvé a publicar y entrá: te va a pedir crear una nueva con el código de instalación. Después sacá esa variable.
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
