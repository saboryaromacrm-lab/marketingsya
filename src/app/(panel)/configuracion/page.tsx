import { leerAjuste } from '@/lib/ajustes'
import { leerConfig } from '@/lib/configuracion'
import { urlMedia } from '@/lib/media'
import { SubirLogo } from './SubirLogo'
import { FormContacto } from './Formularios'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Configuración' }

export default async function General() {
  const [logo, config] = await Promise.all([leerAjuste('logo'), leerConfig()])
  return (
    <>
      <section className="tarjeta">
        <h2 className="titulo-seccion">Logo</h2>
        <SubirLogo actual={logo ? urlMedia(logo) : null} />
      </section>
      <section className="tarjeta">
        <h2 className="titulo-seccion">Datos de contacto de las piezas</h2>
        <p className="texto-suave">Salen en todas las promos y carruseles. El QR de la tienda se arma solo con esta dirección.</p>
        <FormContacto inicial={config.contacto} />
      </section>
    </>
  )
}
