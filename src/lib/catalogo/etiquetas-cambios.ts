// Cómo se nombra cada tipo de cambio en la interfaz.
export const NOMBRE_CAMBIO: Record<string, string> = {
  alta: 'Nuevo',
  baja: 'Dado de baja',
  reactivado: 'Volvió',
  precio: 'Precio',
  nombre: 'Nombre',
  marca: 'Marca',
  categoria: 'Categoría',
  etiquetas: 'Etiquetas',
  estado: 'Estado',
  foto: 'Foto',
  fraccionados: 'Fraccionados',
  datos: 'Otros datos',
}

export const NOMBRE_ESTADO: Record<string, string> = {
  en_cola: 'En cola',
  corriendo: 'Corriendo',
  ok: 'Con cambios',
  sin_cambios: 'Sin cambios',
  error: 'Con error',
}
