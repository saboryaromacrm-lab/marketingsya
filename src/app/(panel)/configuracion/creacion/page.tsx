import { leerConfig } from '@/lib/configuracion'
import { listarMusica } from '@/lib/video/musica'
import { versionFfmpeg } from '@/lib/render/video'
import { FormCreacion } from './FormCreacion'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Creación' }

export default async function ConfigCreacion() {
  const [config, musica, ffmpeg] = await Promise.all([leerConfig(), listarMusica(), versionFfmpeg()])
  return <FormCreacion inicial={config.creacion} musica={musica} ffmpeg={ffmpeg} />
}
