import type { EstadoIA } from './claude'

// Si la IA se puede usar en una pantalla (clave cargada y sin pasar el tope), y cuánto cuesta un texto
export type DisponibilidadIA = { disponible: boolean; motivo: string | null; costo: string }

export function disponibilidad(estado: EstadoIA, costo: string): DisponibilidadIA {
  const motivo = !estado.conectada ? 'Cargá la clave de Anthropic en Configuración › Asesor IA.' : estado.cortada ? 'Llegaste al tope del mes de IA.' : null
  return { disponible: !motivo, motivo, costo }
}
