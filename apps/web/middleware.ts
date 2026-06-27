import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

const PROTECTED_PREFIXES = ["/dashboard", "/workspace"]
const AUTH_PAGES = ["/login", "/signup"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = !!getSessionCookie(request)

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isAuthPage = AUTH_PAGES.includes(pathname)

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackURL", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/workspace/:path*", "/login", "/signup"],
}
