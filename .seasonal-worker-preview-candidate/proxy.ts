import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 프로덕션 도메인·엣지에서 옛 HTML/RSC가 붙는 것을 줄이기 위해
 * (Vercel 로그의 PRERENDER/ISR 캐시 완화)
 */
export async function proxy(request: NextRequest) {
  let res = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          res = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    });

    // Validates and refreshes the cookie session when needed.
    await supabase.auth.getClaims();
  }

  if (request.method === "GET") {
    res.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate, max-age=0",
    );
    res.headers.set("Pragma", "no-cache");
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
