import { NextResponse, type NextRequest } from "next/server";

import {
  createEternalBeamAccessSession,
  ETERNAL_BEAM_ACCESS_COOKIE,
  eternalBeamAccessCookieOptions,
} from "@/lib/eternal-beam-access";

function developmentRequestIsAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const configured = process.env.LIFE_ARCHIVE_DEV_ACCESS_SECRET?.trim();
  return Boolean(configured && request.headers.get("x-life-archive-dev-secret") === configured);
}

export async function POST(request: NextRequest) {
  if (!developmentRequestIsAllowed(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const response = NextResponse.json({ status: "enabled" });
  response.cookies.set(
    ETERNAL_BEAM_ACCESS_COOKIE,
    createEternalBeamAccessSession("development"),
    eternalBeamAccessCookieOptions(),
  );
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!developmentRequestIsAllowed(request)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const response = NextResponse.json({ status: "disabled" });
  response.cookies.set(ETERNAL_BEAM_ACCESS_COOKIE, "", eternalBeamAccessCookieOptions(0));
  return response;
}
