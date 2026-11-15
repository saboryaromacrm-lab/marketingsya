import { NextResponse } from 'next/server'
import { COOKIE_SESION } from '@/lib/auth/sesion'

// POST para que un enlace o una vista previa no cierre la sesión sin querer.
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/ingresar', req.url), 303)
  res.cookies.delete(COOKIE_SESION)
  return res
}
