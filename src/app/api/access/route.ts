import { NextResponse } from 'next/server'

const ACCESS_COOKIE = 'mmc_access'
const ACCESS_PASSWORD = process.env.SITE_ACCESS_PASSWORD ?? 'malvavisco'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (password !== ACCESS_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ACCESS_COOKIE, ACCESS_PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  })
  return response
}
