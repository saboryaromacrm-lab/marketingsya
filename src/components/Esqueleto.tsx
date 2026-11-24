// Pantalla de carga: el esqueleto de una sección mientras llegan sus datos.
// Lo usan los loading.tsx: Next lo precarga con el menú y lo muestra al instante al tocar una sección,
// así la pantalla responde en el momento en lugar de quedarse quieta hasta que contesta el servidor.

export function Esqueleto({ contenedor = true, cabecera = true, submenu = false, bloques = 6 }: {
  // Con el marco de la sección (.contenido); sin él cuando el layout de la sección ya lo pone
  contenedor?: boolean
  // Título y subtítulo grises (no hace falta cuando el layout de la sección ya muestra su cabecera)
  cabecera?: boolean
  // Columna del submenú a la izquierda
  submenu?: boolean
  bloques?: number
}) {
  const cuerpo = (
    <div className="esqueleto-bloques">
      <div className="esqueleto-barra esqueleto-ancha" />
      <div className="esqueleto-grilla">
        {Array.from({ length: bloques }, (_, i) => <div key={i} className="esqueleto-tarjeta" />)}
      </div>
    </div>
  )
  const dentro = (
    <>
      {cabecera && (
        <div className="esqueleto-cabecera">
          <div className="esqueleto-barra esqueleto-miga" />
          <div className="esqueleto-barra esqueleto-titulo" />
          <div className="esqueleto-barra esqueleto-sub" />
        </div>
      )}
      {submenu ? <div className="dos-columnas"><div className="esqueleto-submenu" />{cuerpo}</div> : cuerpo}
    </>
  )
  return (
    <div className={contenedor ? 'contenido esqueleto' : 'esqueleto'} aria-busy="true" aria-live="polite">
      <span className="solo-lector">Cargando…</span>
      {dentro}
    </div>
  )
}
