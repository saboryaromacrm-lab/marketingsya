import { Esqueleto } from '@/components/Esqueleto'

// Creación: el layout ya pone el marco; cada página trae su cabecera y el submenú.
export default function Cargando() {
  return <Esqueleto contenedor={false} submenu />
}
