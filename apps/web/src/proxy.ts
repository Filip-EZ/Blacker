import { NextResponse, type NextRequest } from 'next/server';

/**
 * HTTP Basic Auth for the whole dashboard (the Vercel URL is public). Any user name works;
 * the password comes from DASHBOARD_PASSWORD. Without it set (local dev) the site is open.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = decodeBase64Utf8(encoded);
    if (decoded != null && safeEqual(decoded.slice(decoded.indexOf(':') + 1), password)) return NextResponse.next();
  }
  return new NextResponse('Wymagane hasło.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Blacker", charset="UTF-8"' },
  });
}

/** Browsers send Basic credentials as UTF-8 bytes in base64; null for malformed input. */
function decodeBase64Utf8(value: string) {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Constant-time comparison, so response timing does not leak the password. */
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
