// El ingreso es con un PIN numérico (pedido de Lucas, 18/11/2026).
// De 4 a 8 dígitos: 4 alcanza para recordarlo fácil; si algún día quiere más seguridad, pone uno más largo.
// Con 4 dígitos hay solo 10.000 combinaciones: por eso existe el freno general en limite.ts.

export const PIN_MINIMO = 4
export const PIN_MAXIMO = 8

export function esPinValido(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MINIMO},${PIN_MAXIMO}}$`).test(pin)
}

export const AYUDA_PIN = `De ${PIN_MINIMO} a ${PIN_MAXIMO} números.`
export const ERROR_PIN = `El PIN tiene que tener de ${PIN_MINIMO} a ${PIN_MAXIMO} números, sin letras ni espacios.`
