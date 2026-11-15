import { inArray } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { fotoEfectiva } from '@/lib/catalogo/fotos-propias'
import { pesos } from '@/lib/formato'
import { urlMedia } from '@/lib/media'
import { CONTACTO, escaparHtml as e, PALETA, respuestaHtml } from '@/lib/piezas/html'

// Placa de PRUEBA del motor (diagnóstico). No es ninguno de los 3 estilos: esos llegan con los HTML de Lucas.
// 1: portada · 2 a 4: un producto cada una · 5: cierre con los datos de contacto.

const { productos } = esquema

export async function GET(req: Request, { params }: { params: Promise<{ placa: string }> }) {
  const placa = Number((await params).placa)
  const ids = (new URL(req.url).searchParams.get('productos') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 3)
  const filas = ids.length
    ? await db.select({ id: productos.id, nombre: productos.nombrePiezas, sugerido: productos.nombreSugerido, foto: fotoEfectiva, precios: productos.preciosLista }).from(productos).where(inArray(productos.id, ids))
    : []
  const p = placa >= 2 && placa <= 4 ? filas.find((f) => f.id === ids[placa - 2]) : undefined

  let cuerpo: string
  if (placa === 1) {
    cuerpo = `<div class="centro"><p class="chico">Plataforma de marketing</p><h1>Prueba del<br>motor de piezas</h1><p class="chico">${e(new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' }))}</p></div>`
  } else if (placa === 5) {
    cuerpo = `<div class="centro"><h1>Distribuimos<br>bienestar.</h1><p class="grande">${e(CONTACTO.web)}</p><p class="grande">${e(CONTACTO.whatsapp)}</p><p class="grande">${e(CONTACTO.instagram)}</p></div>`
  } else if (p) {
    const precio = p.precios['3']
    cuerpo = `<div class="producto">
      ${p.foto ? `<img src="${e(urlMedia(p.foto))}" alt="">` : '<div class="sin-foto">Sin foto</div>'}
      <h2>${e(p.nombre ?? p.sugerido)}</h2>
      ${precio ? `<p class="precio">${e(pesos(precio.precio))}</p>` : ''}
    </div>`
  } else {
    cuerpo = `<div class="centro"><h2>Placa ${e(placa)}</h2></div>`
  }

  return respuestaHtml(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    html, body { width: 1080px; height: 1350px; }
    body { background: #fbf6ec; color: ${PALETA.verde}; font-family: Georgia, 'DejaVu Serif', serif; position: relative; overflow: hidden; }
    .centro { position: absolute; inset: 0 0 160px; display: grid; place-content: center; text-align: center; gap: 36px; padding: 80px; }
    h1 { font-size: 104px; font-style: italic; line-height: 1.05; }
    h2 { font-size: 64px; font-style: italic; line-height: 1.1; }
    .chico { font: 600 34px sans-serif; letter-spacing: .08em; text-transform: uppercase; color: ${PALETA.verde2}; }
    .grande { font: 700 46px sans-serif; }
    .producto { position: absolute; inset: 70px 70px 180px; display: grid; justify-items: center; align-content: center; gap: 28px; text-align: center; }
    .producto img { width: 760px; height: 760px; object-fit: contain; background: #fff; border-radius: 50%; border: 14px solid ${PALETA.oliva}; }
    .sin-foto { width: 760px; height: 760px; border-radius: 50%; background: #eee; display: grid; place-items: center; font: 600 40px sans-serif; color: #888; }
    .precio { background: ${PALETA.naranja}; color: #fff; font: 800 72px sans-serif; padding: 10px 40px; border-radius: 60px; }
    footer { position: absolute; left: 0; right: 0; bottom: 0; height: 130px; background: ${PALETA.verde}; color: #fff; display: flex; justify-content: center; align-items: center; gap: 40px; font: 700 34px sans-serif; }
    .marca-prueba { position: absolute; top: 28px; right: 34px; font: 800 26px sans-serif; color: ${PALETA.naranja}; letter-spacing: .1em; }
  </style></head><body>
    <span class="marca-prueba">PRUEBA · ${e(placa)}/5</span>
    ${cuerpo}
    <footer><span>${e(CONTACTO.web)}</span><span>${e(CONTACTO.whatsapp)}</span></footer>
  </body></html>`)
}
