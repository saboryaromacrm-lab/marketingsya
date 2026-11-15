import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESION, tokenValido } from '@/lib/auth/sesion'

// Todo pide sesión, salvo la pantalla de ingreso, el chequeo de salud
// y (más adelante) las imágenes públicas que necesita Meta.
export function proxy(req: NextRequest) {
  const secreto = process.env.SESION_SECRETO ?? ''
  if (tokenValido(req.cookies.get(COOKIE_SESION)?.value, secreto)) return NextResponse.next()

  const destino = req.nextUrl.pathname + req.nextUrl.search
  const url = new URL('/ingresar', req.url)
  if (destino !== '/') url.searchParams.set('volver', destino)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!ingresar|api/salud|media|_next/static|_next/image|favicon.ico|icono.png).*)'],
}
