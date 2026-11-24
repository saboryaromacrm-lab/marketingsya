import { Esqueleto } from '@/components/Esqueleto'

// Dentro de la sección (su cabecera y su submenú ya están): solo el contenido gris.
export default function Cargando() {
  return <Esqueleto contenedor={false} cabecera={false} />
}
