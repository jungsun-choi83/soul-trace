const FALLBACK = "/shop/";

export function getMemoryShopUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_MEMORY_SHOP_URL ?? "").trim();
  if (!raw) return FALLBACK;
  if (raw.startsWith("/")) {
    const path = raw.split("?")[0].replace(/\/+$/, "") || "/shop";
    return `${path}/`;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return FALLBACK;
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return path ? `${parsed.origin}${path}/` : `${parsed.origin}/`;
  } catch {
    return FALLBACK;
  }
}

export function getMemoryShopLetterSetUrl(): string {
  const base = getMemoryShopUrl();
  const url = base.startsWith("/") ? new URL(base, "https://soultrace.pet") : new URL(base);
  url.searchParams.set("product", "letter");
  return base.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
}
