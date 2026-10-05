import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/pin-login')) {
    return NextResponse.next()
  }

  // Machine-to-machine routes authenticate with their own Bearer token.
  if (request.nextUrl.pathname.startsWith('/api/integrations/kph/')) {
    return NextResponse.next()
  }

  const miseSession = request.cookies.get('mise-session')
  if (miseSession?.value) {
    return NextResponse.next()
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
