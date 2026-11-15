// Íconos Material (los mismos que usa el ERP), servidos desde nuestro servidor.
export function Icono({ nombre, tamano = 18, className }: { nombre: string; tamano?: number; className?: string }) {
  return (
    <span className={`material-icons ${className ?? ''}`} style={{ fontSize: tamano }} aria-hidden="true">
      {nombre}
    </span>
  )
}
