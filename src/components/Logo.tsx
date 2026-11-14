// Lugar del logo circular. Mientras no esté el archivo, muestra las iniciales.
// Cuando llegue, va en public/logo.png y se cambia este componente por un <img>.
export function Logo({ tamano = 40 }: { tamano?: number }) {
  return (
    <span className="logo" style={{ width: tamano, height: tamano, fontSize: tamano * 0.3 }} aria-label="Sabor y Aroma">
      SyA
    </span>
  )
}
