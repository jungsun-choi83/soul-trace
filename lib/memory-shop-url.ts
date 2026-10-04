const FALLBACK = "https://soultrace.pet/shop";

export function getMemoryShopUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_MEMORY_SHOP_URL ?? "").trim();
  if (!raw) return FALLBACK;
  if (raw.startsWith("/")) {
    return raw.split("?")[0].replace(/\/+$/, "") || "/shop";
  }
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
  return getMemoryShopUrl();
}
