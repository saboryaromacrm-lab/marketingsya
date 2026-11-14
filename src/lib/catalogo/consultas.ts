import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

// Números del catálogo para avisos y contadores. Una sola consulta.
export async function resumenCatalogo() {
  const { rows } = await db.execute<{
    activos: number; granel: number; sin_foto: number; sin_precio: number; de_baja: number; marcas: number; categorias: number
  }>(sql`
    select
      count(*) filter (where not dado_de_baja)::int as activos,
      count(*) filter (where not dado_de_baja and tipo = 'granel')::int as granel,
      count(*) filter (where not dado_de_baja and imagen_archivo is null)::int as sin_foto,
      count(*) filter (where not dado_de_baja and precio_minorista is null)::int as sin_precio,
      count(*) filter (where dado_de_baja)::int as de_baja,
      (select count(*) from marcas where not dada_de_baja)::int as marcas,
      count(distinct categoria) filter (where not dado_de_baja)::int as categorias
    from productos`)
  const r = rows[0]
  return { activos: r.activos, granel: r.granel, sinFoto: r.sin_foto, sinPrecio: r.sin_precio, deBaja: r.de_baja, marcas: r.marcas, categorias: r.categorias }
}

export async function productosSinFoto(): Promise<number> {
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from productos where not dado_de_baja and imagen_archivo is null`)
  return rows[0]?.n ?? 0
}
