import Link from 'next/link'
import { Aviso } from '@/components/Aviso'
import { Icono } from '@/components/Icono'
import { resumenCatalogo } from '@/lib/catalogo/consultas'
import { ultimaSincronizacionBuena } from '@/lib/catalogo/iniciar'
import { cuando, numero, plural } from '@/lib/formato'

export default async function Catalogo() {
  const [r, ultima] = await Promise.all([resumenCatalogo(), ultimaSincronizacionBuena()])

  if (!ultima || r.activos === 0) {
    return (
      <div className="vacio">
        <Icono nombre="inventory_2" tamano={40} />
        <p><b>Todavía no hay productos.</b> Apretá «Sincronizar ahora» para traer el catálogo del ERP.</p>
        <p>La primera vez tarda un par de minutos porque copia todas las fotos.</p>
      </div>
    )
  }

  const tarjetas = [
    { dato: r.activos, texto: 'productos', icono: 'inventory_2' },
    { dato: r.granel, texto: 'a granel', icono: 'scale' },
    { dato: r.marcas, texto: 'marcas', icono: 'sell' },
    { dato: r.categorias, texto: 'categorías', icono: 'category' },
  ]

  return (
    <>
      <div>
        <h2 className="titulo-seccion">Productos</h2>
        <p className="texto-suave">
          Última sincronización {cuando(ultima.terminadaEn ?? ultima.creadoEn)}.{' '}
          <Link href="/catalogo/sincronizaciones">Ver historial</Link>
        </p>
      </div>
      <div className="cifras">
        {tarjetas.map((t) => (
          <div key={t.texto} className="cifra">
            <Icono nombre={t.icono} tamano={22} />
            <b>{numero(t.dato)}</b>
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
      {r.sinFoto > 0 && (
        <Aviso tono="ambar" dato={`${plural(r.sinFoto, 'producto no tiene', 'productos no tienen')} foto`}>
          en el ERP: no se van a poder usar en piezas hasta que subas una (paso 4).
        </Aviso>
      )}
      {r.sinPrecio > 0 && (
        <Aviso tono="verde" dato={`${plural(r.sinPrecio, 'producto no tiene', 'productos no tienen')} precio minorista`}>
          en el ERP: aparecen igual, pero sin precio en las piezas.
        </Aviso>
      )}
      {r.deBaja > 0 && (
        <Aviso tono="verde" dato={`${plural(r.deBaja, 'producto dado de baja', 'productos dados de baja')}:`}>
          ya no vienen del ERP. Se guardan para no romper piezas viejas.
        </Aviso>
      )}
      <div className="vacio vacio-chico">
        <Icono nombre="table_rows" tamano={28} />
        <p>La tabla con buscador y filtros llega en el paso 3.</p>
      </div>
    </>
  )
}
