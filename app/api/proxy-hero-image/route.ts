import { isAllowedHeroImageFetchUrl } from "@/lib/hero-image-proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_PARAM_MAX = 4096;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw || raw.length > URL_PARAM_MAX) {
    return NextResponse.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Malformed url." }, { status: 400 });
  }

  if (!isAllowedHeroImageFetchUrl(target)) {
    return NextResponse.json({ error: "Host not allowed." }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      redirect: "follow",
      headers: { Accept: "image/*" },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream fetch failed." }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch error." }, { status: 502 });
  }
}
