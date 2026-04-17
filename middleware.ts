import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * 프로덕션 도메인·엣지에서 옛 HTML/RSC가 붙는 것을 줄이기 위해
 * (Vercel 로그의 PRERENDER/ISR 캐시 완화)
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next();
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
