import { desc, eq } from 'drizzle-orm'
import { Cabecera } from '@/components/Cabecera'
import { db, esquema } from '@/lib/db'
import { leerConfig } from '@/lib/configuracion'
import { productosPieza } from '@/lib/carruseles/datos'
import { estadoIA } from '@/lib/ia/claude'
import { historialChat, leerSemana, leerSugerencias, lunesDe } from '@/lib/ia/asesor'
import { proximasFechas } from '@/lib/ia/fechas-especiales'
import { aprox, costoEstimado } from '@/lib/ia/precios'
import { esFecha, hoyFormosa } from '@/lib/promos/fechas'
import { AsesorIA, type Pestana } from './AsesorIA'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Asesor IA' }

export default async function Asesor({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const pestana: Pestana = (['calendario', 'sugerencias', 'recetas', 'chat'] as const).find((p) => p === q.pestana) ?? 'calendario'
  const hoy = hoyFormosa()
  const lunes = lunesDe(esFecha(q.semana) ? q.semana : hoy)
  const config = await leerConfig()
  const [estado, semana, sugerencias, chat, recetas] = await Promise.all([
    estadoIA(config), leerSemana(lunes), leerSugerencias(), historialChat(),
    db.select({ id: esquema.carruseles.id, titulo: esquema.carruseles.titulo, creadoEn: esquema.carruseles.creadoEn }).from(esquema.carruseles).where(eq(esquema.carruseles.estilo, 'recetas')).orderBy(desc(esquema.carruseles.id)).limit(6),
  ])
  const ids = [...(semana?.ideas.flatMap((i) => i.productos) ?? []), ...(sugerencias?.ideas.map((i) => i.id) ?? [])]
  const info = Object.fromEntries([...(await productosPieza([...new Set(ids)])).values()].map((p) => [p.id, { nombre: p.nombre, foto: p.foto }]))
  const m = config.ia.modelo
  return (
    <div className="contenido">
      <Cabecera titulo="Asesor IA" subtitulo="Ideas, calendario, recetas y textos. Nada se publica sin tu aprobación." miga={[{ texto: 'Asesor IA' }]} />
      <AsesorIA
        pestana={pestana}
        estadoInicial={estado}
        lunes={lunes}
        hoy={hoy}
        semanaInicial={semana}
        sugerenciasIniciales={sugerencias}
        chatInicial={chat.map((c) => ({ rol: c.rol, texto: c.texto }))}
        recetas={recetas.map((r) => ({ id: r.id, titulo: r.titulo }))}
        info={info}
        fechas={config.ia.fechasEspeciales ? proximasFechas(hoy, 35) : []}
        calendarioVacio={Object.values(config.ia.calendario).every((x) => x === 'nada')}
        costos={{ semana: aprox(costoEstimado(m, 'semana')), sugerencias: aprox(costoEstimado(m, 'sugerencias')), receta: aprox(costoEstimado(m, 'receta')), chat: aprox(costoEstimado(m, 'chat')) }}
      />
    </div>
  )
}
