import 'server-only'
import { graph, type Graph } from './graph'
import { ErrorMeta } from './errores'
import { tokenDePagina, type CuentasMeta } from './conexion'

// Las cuatro formas de publicar: feed y historia, en Instagram y en Facebook.
// Instagram: primero se crea un «contenedor» con la imagen (Meta la descarga de la dirección pública),
// se espera a que esté listo y recién ahí se publica. Facebook: se sube la foto a la página.

export type Publicado = { metaId: string; enlace: string | null }
type Base = { g: Graph; cuentas: CuentasMeta; version: string }

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const PAUSA = Number(process.env.META_PAUSA_MS ?? 3000)

/** Si Meta no acepta el texto alternativo (parámetro nuevo), se vuelve a pedir sin él. */
async function conAlt<T>(alt: string | null, pedir: (alt: string | null) => Promise<T>): Promise<T> {
  try {
    return await pedir(alt)
  } catch (e) {
    if (alt && e instanceof ErrorMeta && e.codigo === 100 && /alt/i.test(e.message)) return pedir(null)
    throw e
  }
}

function instagramDe(cuentas: CuentasMeta): string {
  if (!cuentas.instagramId) throw new ErrorMeta({ mensaje: 'La página de Facebook no tiene un Instagram de empresa vinculado. Vinculalo en Meta y tocá «Probar conexión» en Configuración › Meta.', reintentable: false })
  return cuentas.instagramId
}

/** Espera a que Instagram termine de procesar el contenedor (con imágenes suele ser al toque). */
async function esperarContenedor(g: Graph, id: string) {
  for (let i = 0; i < 20; i++) {
    const r = await g.get<{ status_code?: string }>(id, { fields: 'status_code' })
    if (r.status_code === 'FINISHED' || r.status_code === 'PUBLISHED') return
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new ErrorMeta({ mensaje: 'Instagram no pudo procesar la imagen.', reintentable: true })
    await esperar(PAUSA)
  }
  throw new ErrorMeta({ mensaje: 'Instagram tardó demasiado en procesar las imágenes.', reintentable: true })
}

async function publicarContenedor(g: Graph, ig: string, contenedor: string): Promise<Publicado> {
  await esperarContenedor(g, contenedor)
  const { id } = await g.post<{ id: string }>(`${ig}/media_publish`, { creation_id: contenedor }, { final: true })
  const enlace = await g.get<{ permalink?: string }>(id, { fields: 'permalink' }).then((r) => r.permalink ?? null).catch(() => null)
  return { metaId: id, enlace }
}

/** Feed de Instagram: una imagen sola, o un carrusel de 2 a 10. */
export async function instagramFeed(b: Base, urls: string[], texto: string, alt: string | null): Promise<Publicado> {
  const ig = instagramDe(b.cuentas)
  if (urls.length < 1 || urls.length > 10) throw new ErrorMeta({ mensaje: 'Instagram acepta de 1 a 10 imágenes por posteo.', reintentable: false })
  let contenedor: string
  if (urls.length === 1) {
    contenedor = (await conAlt(alt, (a) => b.g.post<{ id: string }>(`${ig}/media`, { image_url: urls[0], caption: texto, alt_text: a }))).id
  } else {
    const hijos: string[] = []
    for (const url of urls) hijos.push((await conAlt(alt, (a) => b.g.post<{ id: string }>(`${ig}/media`, { image_url: url, is_carousel_item: true, alt_text: a }))).id)
    for (const h of hijos) await esperarContenedor(b.g, h)
    contenedor = (await b.g.post<{ id: string }>(`${ig}/media`, { media_type: 'CAROUSEL', children: hijos.join(','), caption: texto })).id
  }
  return publicarContenedor(b.g, ig, contenedor)
}

/** Historia de Instagram (una imagen; las historias no llevan texto). */
export async function instagramHistoria(b: Base, url: string): Promise<Publicado> {
  const ig = instagramDe(b.cuentas)
  const { id } = await b.g.post<{ id: string }>(`${ig}/media`, { image_url: url, media_type: 'STORIES' })
  const r = await publicarContenedor(b.g, ig, id)
  return { ...r, enlace: r.enlace ?? (b.cuentas.instagramUsuario ? `https://www.instagram.com/stories/${b.cuentas.instagramUsuario}/` : null) }
}

async function paginaG(b: Base) {
  return graph(await tokenDePagina(b.g, b.cuentas.paginaId), b.version)
}

async function enlacePost(g: Graph, postId: string) {
  return g.get<{ permalink_url?: string }>(postId, { fields: 'permalink_url' }).then((r) => r.permalink_url ?? null).catch(() => null).then((u) => u ?? `https://www.facebook.com/${postId}`)
}

/** Feed de la página de Facebook: una foto, o varias en un mismo posteo (álbum). */
export async function facebookFeed(b: Base, urls: string[], texto: string, alt: string | null): Promise<Publicado> {
  const g = await paginaG(b)
  const pagina = b.cuentas.paginaId
  if (urls.length === 1) {
    const r = await conAlt(alt, (a) => g.post<{ id: string; post_id?: string }>(`${pagina}/photos`, { url: urls[0], caption: texto, alt_text_custom: a }, { final: true }))
    const postId = r.post_id ?? r.id
    return { metaId: postId, enlace: await enlacePost(g, postId) }
  }
  // Primero se suben las fotos sin publicar; después un solo posteo con todas
  const fotos: string[] = []
  for (const url of urls) fotos.push((await conAlt(alt, (a) => g.post<{ id: string }>(`${pagina}/photos`, { url, published: false, alt_text_custom: a }))).id)
  const adjuntos = Object.fromEntries(fotos.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]))
  const { id } = await g.post<{ id: string }>(`${pagina}/feed`, { message: texto, ...adjuntos }, { final: true })
  return { metaId: id, enlace: await enlacePost(g, id) }
}

/** Historia de la página de Facebook. */
export async function facebookHistoria(b: Base, url: string): Promise<Publicado> {
  const g = await paginaG(b)
  const pagina = b.cuentas.paginaId
  const foto = await g.post<{ id: string }>(`${pagina}/photos`, { url, published: false })
  const r = await g.post<{ success?: boolean; post_id?: string }>(`${pagina}/photo_stories`, { photo_id: foto.id }, { final: true })
  if (r.success === false) throw new ErrorMeta({ mensaje: 'Facebook no aceptó la historia.', reintentable: true })
  const postId = r.post_id ?? foto.id
  return { metaId: postId, enlace: `https://www.facebook.com/${postId}` }
}
