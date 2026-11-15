// El botón y el monitor de avance se comunican con eventos del navegador,
// así el botón puede estar en cualquier página.
export const INICIO = 'sya:sincronizacion-inicio'
export const FIN = 'sya:sincronizacion-fin'
export const avisarInicio = (id: number) => window.dispatchEvent(new CustomEvent(INICIO, { detail: { id } }))
export const avisarFin = () => window.dispatchEvent(new CustomEvent(FIN))
