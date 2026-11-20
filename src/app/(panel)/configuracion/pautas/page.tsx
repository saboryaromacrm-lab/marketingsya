import { leerConfig } from '@/lib/configuracion'
import { estadoMeta } from '@/lib/meta/conexion'
import { leerPublicidad, topeDelMes } from '@/lib/pautas/motor'
import { FormPautas } from './FormPautas'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pautas' }

export default async function ConfigPautas() {
  const [config, meta, publicidad, tope] = await Promise.all([leerConfig(), estadoMeta(), leerPublicidad(), topeDelMes()])
  return <FormPautas inicial={config.pautas} metaConectada={meta.conectada} finToken={meta.finToken} publicidad={publicidad} mes={{ comprometido: tope.comprometido, gastado: tope.gastado }} />
}
