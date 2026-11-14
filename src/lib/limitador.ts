// Reparte pedidos a un servidor externo en el tiempo (ERP, Meta) y permite
// frenar a todos juntos cuando el servidor pide esperar (429).

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Limitador {
  private proximo = 0
  private pausaHasta = 0
  constructor(private intervaloMs: number, private ahora = () => Date.now(), private esperar = dormir) {}

  async turno() {
    for (;;) {
      const t = this.ahora()
      const libre = Math.max(this.proximo, this.pausaHasta)
      if (libre <= t) {
        this.proximo = t + this.intervaloMs
        return
      }
      await this.esperar(libre - t)
    }
  }

  pausar(segundos: number) {
    this.pausaHasta = Math.max(this.pausaHasta, this.ahora() + segundos * 1000)
  }
}
