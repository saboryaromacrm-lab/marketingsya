import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESION, tokenValido } from '@/lib/auth/sesion'
import { firmaValida, rutaCanonica } from '@/lib/render/firma'

// Todo pide sesión, salvo la pantalla de ingreso, el chequeo de salud
// y (más adelante) las imágenes públicas que necesita Meta.
export function proxy(req: NextRequest) {
  const secreto = process.env.SESION_SECRETO ?? ''
  if (tokenValido(req.cookies.get(COOKIE_SESION)?.value, secreto)) return NextResponse.next()
  // Placas que abre Chromium desde el servidor: entran con una firma temporal de esa ruta
  if (req.nextUrl.pathname.startsWith('/render/')) {
    const ruta = rutaCanonica(req.nextUrl.pathname, req.nextUrl.searchParams)
    if (firmaValida(req.nextUrl.searchParams.get('firma'), ruta, secreto)) return NextResponse.next()
  }

  const destino = req.nextUrl.pathname + req.nextUrl.search
  const url = new URL('/ingresar', req.url)
  if (destino !== '/') url.searchParams.set('volver', destino)
  return NextResponse.redirect(url)
}

export const config = {
  // Públicos: fotos y piezas (/media, Meta las necesita), logos (/marca), fuentes (/fuentes) y recursos de los carruseles (/piezas).
  matcher: ['/((?!ingresar|api/salud|media|marca|fuentes|piezas|_next/static|_next/image|favicon.ico|icono.png).*)'],
}
