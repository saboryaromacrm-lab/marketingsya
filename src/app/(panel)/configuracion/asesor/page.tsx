import { leerConfig } from '@/lib/configuracion'
import { estadoIA } from '@/lib/ia/claude'
import { FormAsesor } from '../Formularios'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Asesor IA' }

export default async function ConfigAsesor() {
  const config = await leerConfig()
  const estado = await estadoIA(config)
  return <FormAsesor inicial={config.ia} estado={estado} />
}
