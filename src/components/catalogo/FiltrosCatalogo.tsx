'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Icono } from '@/components/Icono'
import { urlConFiltros, type Filtros } from '@/lib/catalogo/filtros'
import type { OpcionesDeFiltros } from '@/lib/catalogo/listado'

const numero = (n: number) => n.toLocaleString('es-AR')

// Buscador y selects. Cada cambio actualiza la dirección; la página se vuelve a armar en el servidor.
export function FiltrosCatalogo({ filtros, opciones }: { filtros: Filtros; opciones: OpcionesDeFiltros }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [texto, setTexto] = useState(filtros.q)
  const ultimo = useRef(filtros.q)

  // Si la búsqueda cambia desde afuera (buscador de arriba, volver atrás), se refleja acá.
  useEffect(() => {
    setTexto(filtros.q)
    ultimo.current = filtros.q
  }, [filtros.q])

  const ir = (cambios: Partial<Filtros>, reemplazar = false) =>
    empezar(() => (reemplazar ? router.replace : router.push)(urlConFiltros(filtros, cambios), { scroll: false }))

  // Busca solo cuando se deja de escribir un momento
  useEffect(() => {
    if (texto.trim() === ultimo.current) return
    const t = setTimeout(() => {
      ultimo.current = texto.trim()
      ir({ q: texto.trim() }, true)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  const subcategorias = opciones.categorias.find((c) => c.nombre === filtros.categoria)?.subcategorias ?? []

  return (
    <div className={`filtros ${pendiente ? 'filtros-cargando' : ''}`}>
      <label className="filtro-busqueda">
        <Icono nombre="search" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, marca, código o código de barras…"
          aria-label="Buscar productos"
          enterKeyHint="search"
        />
        {pendiente && <Icono nombre="sync" className="girando" />}
      </label>

      <select className="input" value={filtros.categoria ?? ''} onChange={(e) => ir({ categoria: e.target.value || null, subcategoria: null })} aria-label="Categoría">
        <option value="">Todas las categorías</option>
        {opciones.categorias.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre} ({numero(c.n)})</option>)}
      </select>

      {filtros.categoria && subcategorias.length > 0 && (
        <select className="input" value={filtros.subcategoria ?? ''} onChange={(e) => ir({ subcategoria: e.target.value || null })} aria-label="Subcategoría">
          <option value="">Todas las subcategorías</option>
          {subcategorias.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre} ({numero(s.n)})</option>)}
        </select>
      )}

      <select className="input" value={filtros.marca ?? ''} onChange={(e) => ir({ marca: e.target.value === 'sin' ? 'sin' : e.target.value ? Number(e.target.value) : null })} aria-label="Marca">
        <option value="">Todas las marcas</option>
        {opciones.sinMarca > 0 && <option value="sin">Sin marca, a granel ({numero(opciones.sinMarca)})</option>}
        {opciones.marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({numero(m.n)})</option>)}
      </select>

      <select className="input" value={filtros.etiqueta ?? ''} onChange={(e) => ir({ etiqueta: e.target.value || null })} aria-label="Etiqueta">
        <option value="">Todas las etiquetas</option>
        {opciones.etiquetas.map((t) => <option key={t.etiqueta} value={t.etiqueta}>{t.etiqueta} ({numero(t.n)})</option>)}
      </select>

      <select className="input" value={filtros.foto ?? ''} onChange={(e) => ir({ foto: (e.target.value || null) as Filtros['foto'] })} aria-label="Foto">
        <option value="">Con y sin foto</option>
        <option value="con">Con foto</option>
        <option value="sin">Sin foto</option>
      </select>

      <select className="input" value={filtros.piezas ?? ''} onChange={(e) => ir({ piezas: (e.target.value || null) as Filtros['piezas'] })} aria-label="Uso en piezas">
        <option value="">Van y no van en piezas</option>
        <option value="si">Van en piezas</option>
        <option value="no">No van en piezas</option>
      </select>

      <select className="input" value={filtros.lista} onChange={(e) => ir({ lista: Number(e.target.value) })} aria-label="Lista de precios">
        {opciones.listas.map((l) => <option key={l.id} value={l.id}>Precio: {l.nombre === l.modalidad ? l.nombre : `${l.modalidad} (${l.nombre})`}</option>)}
      </select>

      <select className="input" value={filtros.orden} onChange={(e) => ir({ orden: e.target.value as Filtros['orden'] })} aria-label="Orden">
        {filtros.q && <option value="relevancia">Más parecidos primero</option>}
        <option value="nombre">Nombre, de la A a la Z</option>
        <option value="precio-asc">Precio, de menor a mayor</option>
        <option value="precio-desc">Precio, de mayor a menor</option>
        <option value="nuevos">Más nuevos en el ERP</option>
      </select>
    </div>
  )
}
