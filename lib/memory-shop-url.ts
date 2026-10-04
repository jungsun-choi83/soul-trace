const FALLBACK = "https://jungsun-choi83.github.io/soultrace-memory-shop";

export function getMemoryShopUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_MEMORY_SHOP_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) return FALLBACK;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return FALLBACK;
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${path}`;
  } catch {
    return FALLBACK;
  }
}

export function getMemoryShopLetterSetUrl(): string {
  const url = new URL(getMemoryShopUrl());
  url.searchParams.set("product", "letter");
  return url.toString();
}
