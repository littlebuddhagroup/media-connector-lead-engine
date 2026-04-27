import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ACCESS_COOKIE = 'mmc_access'
const ACCESS_PASSWORD = process.env.SITE_ACCESS_PASSWORD ?? 'malvavisco'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Rutas que nunca necesitan comprobación (estáticos, api interna)
  const isStatic = pathname.startsWith('/_next') || pathname.startsWith('/api/access')
  if (isStatic) return NextResponse.next()

  // ── 1. PUERTA DE ACCESO ──────────────────────────────────────────────────
  const accessCookie = request.cookies.get(ACCESS_COOKIE)?.value
  const hasAccess = accessCookie === ACCESS_PASSWORD

  if (!hasAccess && pathname !== '/access') {
    const url = request.nextUrl.clone()
    url.pathname = '/access'
    return NextResponse.redirect(url)
  }

  // Si ya tiene acceso pero está en /access → mandarlo al login
  if (hasAccess && pathname === '/access') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── 2. AUTH SUPABASE (igual que antes) ───────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/access')
  const isPublicApi = pathname.startsWith('/api/auth')

  if (!user && !isAuthPage && !isPublicApi) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
