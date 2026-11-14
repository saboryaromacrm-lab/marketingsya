import { pesos } from '@/lib/formato'

// Muestra el «antes» o el «después» de un cambio de sincronización, según su tipo.
// Lo usan el historial de cada sincronización y el detalle de cada producto.

type Valor = unknown

export function ValorCambio({ tipo, valor, marcasPorId }: { tipo: string; valor: Valor; marcasPorId: Map<number, string> }) {
  if (valor == null || valor === '') return <span className="texto-suave">—</span>
  if (tipo === 'precio' && typeof valor === 'object' && !Array.isArray(valor)) {
    return (
      <div className="lista-precios">
        {Object.entries(valor as Record<string, number | null>).map(([k, v]) => (
          <div key={k}><span className="texto-suave">{k}</span> {v == null ? '—' : pesos(v)}</div>
        ))}
      </div>
    )
  }
  if (tipo === 'alta' && typeof valor === 'object') {
    const p = (valor as { precio: number | null }).precio
    return <span>{p == null ? 'Sin precio minorista' : `${pesos(p)} minorista`}</span>
  }
  if (tipo === 'marca' && typeof valor === 'number') return <span>{marcasPorId.get(valor) ?? `Marca ${valor}`}</span>
  if (tipo === 'foto') return <span>{valor ? 'Foto nueva' : 'Sin foto'}</span>
  if (Array.isArray(valor)) return <span>{valor.length ? valor.join(', ') : 'Ninguna'}</span>
  if (typeof valor === 'object') {
    return (
      <div className="lista-precios">
        {Object.entries(valor as Record<string, unknown>).map(([k, v]) => (
          <div key={k}><span className="texto-suave">{k}</span> {String(v || '—')}</div>
        ))}
      </div>
    )
  }
  return <span>{String(valor)}</span>
}

// En «Otros datos» solo se muestran los campos que cambiaron.
export function soloDistintos(antes: unknown, despues: unknown): [unknown, unknown] {
  if (!antes || !despues || typeof antes !== 'object' || typeof despues !== 'object') return [antes, despues]
  const a: Record<string, unknown> = {}
  const d: Record<string, unknown> = {}
  for (const k of Object.keys(despues)) {
    const va = (antes as Record<string, unknown>)[k]
    const vd = (despues as Record<string, unknown>)[k]
    if (JSON.stringify(va) !== JSON.stringify(vd)) {
      a[k] = va
      d[k] = vd
    }
  }
  return [a, d]
}

