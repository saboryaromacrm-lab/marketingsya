// Logo circular. Por defecto, los de la marca (public/marca); se puede cambiar desde Configuración.
export function Logo({ tamano = 40, src }: { tamano?: number; src?: string | null }) {
  if (src) {
    return <img className="logo logo-imagen" src={src} alt="Sabor y Aroma" width={tamano} height={tamano} />
  }
  return (
    <span className="logo" style={{ width: tamano, height: tamano, fontSize: tamano * 0.3 }} aria-label="Sabor y Aroma">
      SyA
    </span>
  )
}
