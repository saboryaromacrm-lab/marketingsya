import { leerConfig } from '@/lib/configuracion'
import { estadoMeta } from '@/lib/meta/conexion'
import { FormMeta } from './FormMeta'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Meta' }

export default async function ConfigMeta() {
  const [config, estado] = await Promise.all([leerConfig(), estadoMeta()])
  return <FormMeta inicial={config.meta} estado={estado} />
}
