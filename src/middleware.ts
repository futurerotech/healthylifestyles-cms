import { NextResponse, type NextRequest } from 'next/server';

/**
 * Default the Payload admin to DARK theme on first load, while keeping the
 * light/dark toggle working.
 *
 * Why: Payload's getRequestTheme() resolves (cookie → Sec-CH header → 'light').
 * The default fallback is 'light', so a brand-new visitor gets light. By
 * setting the `payload-theme=dark` cookie here when no preference exists yet,
 * the cookie check wins and the admin loads dark. When the user toggles via
 * the ThemeProvider UI, it writes a new `payload-theme` value and this
 * middleware leaves it untouched.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Only manage the theme cookie on admin routes.
  const url = req.nextUrl;
  if (!url.pathname.startsWith('/admin')) {
    return res;
  }

  const existing = req.cookies.get('payload-theme');
  if (!existing) {
    res.cookies.set('payload-theme', 'dark', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
