import { leerConfig } from '@/lib/configuracion'

// Página pública (sin sesión): Meta pide una política de privacidad para pasar la app a modo «Activo».
// Los datos de contacto salen de Configuración › General.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Política de privacidad', robots: { index: true, follow: false } }

export default async function Privacidad() {
  const { contacto } = await leerConfig()
  return (
    <main className="pagina-publica">
      <article className="tarjeta pagina-publica-texto">
        <h1 className="titulo-pagina">Política de privacidad</h1>
        <p className="texto-suave">Plataforma de marketing de Sabor y Aroma · actualizada el 19/11/2026</p>

        <h2 className="titulo-seccion">Qué es</h2>
        <p>
          Es una herramienta interna de Sabor y Aroma, distribuidora y dietética de Formosa Capital (Argentina), para diseñar piezas
          con su propio catálogo de productos y publicarlas en sus propias cuentas de Instagram y Facebook. No es una aplicación para el público.
        </p>

        <h2 className="titulo-seccion">Qué datos usa</h2>
        <ul>
          <li>El catálogo de productos de Sabor y Aroma (nombres, precios y fotos).</li>
          <li>El token de acceso de Meta de las cuentas de Sabor y Aroma, guardado cifrado, y los datos básicos de esas cuentas (nombre de la página e identificador de Instagram).</li>
          <li>Los textos e imágenes que Sabor y Aroma publica.</li>
        </ul>
        <p>
          No recolecta datos de personas usuarias de Instagram o Facebook, no lee mensajes ni comentarios, no usa cookies de seguimiento
          y no vende ni comparte datos con nadie.
        </p>

        <h2 className="titulo-seccion">Para qué usa los permisos de Meta</h2>
        <p>
          Solo para ver qué página e Instagram tiene asignados, publicar imágenes y textos en ellos (feed e historias) cuando Sabor y Aroma
          lo aprueba, y consultar cuántas publicaciones quedan disponibles en el día.
        </p>

        <h2 className="titulo-seccion" id="borrado">Cómo borrar los datos</h2>
        <p>
          El token se borra desde la plataforma (Configuración › Meta › Desconectar) o quitándole el acceso a la app en la configuración del
          negocio de Meta. Para pedir el borrado de cualquier otro dato, escribinos y lo hacemos dentro de los 30 días.
        </p>

        <h2 className="titulo-seccion">Contacto</h2>
        <p>
          WhatsApp {contacto.whatsapp} · Instagram {contacto.instagram} · {contacto.web}
        </p>
      </article>
    </main>
  )
}
