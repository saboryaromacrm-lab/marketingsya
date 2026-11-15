import Link from 'next/link'
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import { normalizarTexto } from '@/lib/catalogo/busqueda'
import { urlMedia } from '@/lib/media'
import { numero, plural } from '@/lib/formato'

const { marcas, productos } = esquema

// Iniciales para las marcas sin logo: «LA SERENISIMA» → «LS», «ADES» → «AD», «3 CORAZONES» → «3C»
function iniciales(nombre: string) {
  const palabras = nombre.split(/\s+/).filter((w) => w.length > 2 || /^\d/.test(w))
  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase()
  return (palabras[0] ?? nombre).slice(0, 2).toUpperCase()
}

export default async function Marcas({ searchParams }: { searchParams: Promise<{ q?: string; logo?: string }> }) {
  const { q = '', logo } = await searchParams
  const filtroLogo = logo === 'con' || logo === 'sin' ? logo : null
  const busqueda = normalizarTexto(q)

  const filas = await db
    .select({
      id: marcas.id,
      nombre: marcas.nombre,
      logoArchivo: marcas.logoArchivo,
      productos: sql<number>`count(${productos.id}) filter (where not ${productos.dadoDeBaja})::int`,
    })
    .from(marcas)
    .leftJoin(productos, eq(productos.marcaId, marcas.id))
    .where(and(eq(marcas.dadaDeBaja, false), filtroLogo === 'con' ? isNotNull(marcas.logoArchivo) : filtroLogo === 'sin' ? isNull(marcas.logoArchivo) : undefined))
    .groupBy(marcas.id)
    .orderBy(asc(marcas.nombre))

  // La lista es corta (≈260): se filtra acá, sin tildes ni mayúsculas
  const visibles = busqueda ? filas.filter((m) => normalizarTexto(m.nombre).includes(busqueda)) : filas
  const sinLogo = filas.filter((m) => !m.logoArchivo).length

  return (
    <>
      <div>
        <h2 className="titulo-seccion">Marcas</h2>
        <p className="texto-suave">{plural(filas.length, 'marca', 'marcas')}. Clic en una para ver sus productos.</p>
      </div>
      {!filtroLogo && sinLogo > 0 && (
        <Aviso tono="ambar" dato={`${plural(sinLogo, 'marca no tiene', 'marcas no tienen')} logo`} accion={<Link className="btn btn-chico" href="/catalogo/marcas?logo=sin">Ver cuáles</Link>}>
          en el ERP. En las piezas se usa el nombre escrito.
        </Aviso>
      )}
      <form className="filtros filtros-marcas" action="/catalogo/marcas">
        <label className="filtro-busqueda">
          <Icono nombre="search" />
          <input type="search" name="q" defaultValue={q} placeholder="Buscar marca…" aria-label="Buscar marca" />
        </label>
        <select className="input" name="logo" defaultValue={filtroLogo ?? ''} aria-label="Logo">
          <option value="">Con y sin logo</option>
          <option value="con">Con logo</option>
          <option value="sin">Sin logo</option>
        </select>
        <button className="btn">Filtrar</button>
      </form>
      {visibles.length === 0 ? (
        <div className="vacio vacio-chico"><p><b>No hay marcas con «{q}».</b></p></div>
      ) : (
        <div className="grilla-marcas">
          {visibles.map((m) => (
            <Link key={m.id} href={`/catalogo?marca=${m.id}`} className="tarjeta-marca">
              <div className={`logo-marca ${m.logoArchivo ? '' : 'logo-marca-vacio'}`}>
                {m.logoArchivo ? <img src={urlMedia(m.logoArchivo)} alt="" loading="lazy" /> : <span>{iniciales(m.nombre)}</span>}
              </div>
              <div>
                <div className="nombre-producto">{m.nombre}</div>
                <div className="texto-chico">{m.productos === 0 ? 'Sin productos activos' : plural(m.productos, 'producto', 'productos')}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="texto-suave">Mostrando {numero(visibles.length)} de {numero(filas.length)}.</p>
    </>
  )
}
