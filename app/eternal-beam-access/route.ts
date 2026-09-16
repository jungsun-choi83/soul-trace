import { NextResponse, type NextRequest } from "next/server";

import { redeemEternalBeamAccess } from "@/lib/eternal-beam-access-redemption";
import {
  createPersistentEternalBeamAccessSession,
  ETERNAL_BEAM_ACCESS_COOKIE,
  eternalBeamAccessCookieOptions,
} from "@/lib/eternal-beam-access";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,128}$/;

function redirect(request: NextRequest, pathname: string) {
  const response = NextResponse.redirect(new URL(pathname, request.url), 303);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const handoff = request.nextUrl.searchParams.get("handoff") ?? "";
  if (!TOKEN_PATTERN.test(handoff)) return redirect(request, "/eternal-beam-access/error");
  try {
    const identity = await redeemEternalBeamAccess(handoff);
    const sessionId = await createPersistentEternalBeamAccessSession(identity);
    const response = redirect(request, "/life-archive");
    response.cookies.set(
      ETERNAL_BEAM_ACCESS_COOKIE,
      sessionId,
      eternalBeamAccessCookieOptions(),
    );
    return response;
  } catch {
    return redirect(request, "/eternal-beam-access/error");
  }
}
