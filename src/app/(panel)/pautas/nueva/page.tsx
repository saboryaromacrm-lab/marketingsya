import { notFound } from 'next/navigation'
import { leerConfig } from '@/lib/configuracion'
import { OBJETIVOS_PAUTA, type ObjetivoPauta } from '@/lib/configuracion-tipos'
import { estadoMeta } from '@/lib/meta/conexion'
import { hoyFormosa } from '@/lib/promos/fechas'
import { leerPublicidad, promocionable, topeDelMes } from '@/lib/pautas/motor'
import { resumenPublico } from '@/lib/pautas/reglas'
import { Promocionar } from './Promocionar'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Promocionar' }

type Q = { publicacion?: string; objetivo?: string; porDia?: string; dias?: string }

export default async function NuevaPauta({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams
  const p = await promocionable(Number(q.publicacion))
  if (!p) notFound()
  const [config, meta, publicidad, tope] = await Promise.all([leerConfig(), estadoMeta(), leerPublicidad(), topeDelMes()])
  const objetivo = (Object.keys(OBJETIVOS_PAUTA) as ObjetivoPauta[]).find((k) => k === q.objetivo) ?? (p.instagram ? config.pautas.objetivo : 'alcance')
  const porDia = Math.round(Number(q.porDia)) > 0 ? Math.round(Number(q.porDia)) : config.pautas.porDia
  const dias = Math.round(Number(q.dias)) > 0 ? Math.min(90, Math.round(Number(q.dias))) : config.pautas.dias
  return (
    <Promocionar
      publicacion={{ id: p.id, titulo: p.titulo, texto: p.texto, imagen: p.imagen, publicadaEn: p.publicadaEn?.toISOString() ?? null, instagram: p.instagram?.enlace ?? (p.instagram ? '' : null), facebook: p.facebook?.enlace ?? (p.facebook ? '' : null) }}
      inicial={{ objetivo, publicoId: config.pautas.publicoEntrada, porDia, dias }}
      publicos={config.pautas.publicos.map((x) => ({ id: x.id, nombre: x.nombre, resumen: resumenPublico(x) }))}
      ubicaciones={config.pautas.ubicaciones}
      hoy={hoyFormosa()}
      cuenta={publicidad ? { nombre: publicidad.nombre, moneda: publicidad.moneda, activa: publicidad.activa, minDiario: publicidad.minDiario, whatsapp: publicidad.whatsapp } : null}
      metaConectada={meta.conectada}
      tope={{ tope: tope.tope, comprometido: tope.comprometido, cortar: tope.cortar }}
      ajustes={{ iva: config.pautas.iva, escribirDesde: config.pautas.escribirDesde, whatsapp: config.contacto.whatsapp, web: config.contacto.web }}
    />
  )
}
