import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient, getSupabaseServerConfig } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const PREVIEW_EMAIL = "local-preview@soultrace.test";

function localHostname(host: string) {
  const name = host.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  if (name === "localhost" || name === "::1" || name.endsWith(".local") || name.startsWith("127.")) return true;
  const parts = name.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31);
}

function previewPassword() {
  const holder = globalThis as { __soultraceLocalPreviewPassword?: string };
  if (!holder.__soultraceLocalPreviewPassword) {
    holder.__soultraceLocalPreviewPassword = `LocalPreview-${crypto.randomUUID()}`;
  }
  return holder.__soultraceLocalPreviewPassword;
}

async function userIdForEmail(url: string, key: string) {
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(PREVIEW_EMAIL)}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { users?: { id?: string; email?: string }[]; id?: string; email?: string };
  if (payload.email === PREVIEW_EMAIL && typeof payload.id === "string") return payload.id;
  return payload.users?.find((user) => user.email === PREVIEW_EMAIL && typeof user.id === "string")?.id ?? null;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || !localHostname(request.headers.get("host") ?? "")) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  const config = getSupabaseServerConfig();
  const admin = createSupabaseServerClient();
  const session = await createSupabaseAuthServerClient();
  if (!config || !admin || !session) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const password = previewPassword();
  const created = await admin.auth.admin.createUser({
    email: PREVIEW_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { locale: "ko", localPreview: true },
  });
  if (created.error) {
    const userId = created.data.user?.id ?? await userIdForEmail(config.url, config.key);
    if (!userId) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    const updated = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (updated.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const signedIn = await session.auth.signInWithPassword({ email: PREVIEW_EMAIL, password });
  if (signedIn.error || !signedIn.data.session) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
