import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { getPublicSupabaseConfig } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient, getSupabaseServerConfig } from "@/lib/supabase-server";

const PREVIEW_EMAIL = "local-preview@soultrace.test";

function hostName(host: string) {
  return host.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
}

function previewHostAllowed(host: string) {
  const name = hostName(host);
  if (name === "soultrace.pet" || name === "www.soultrace.pet") return true;
  if (process.env.NODE_ENV === "production") return false;
  return localHostname(name);
}

function localHostname(host: string) {
  const name = hostName(host);
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

function jsonWithSessionCookies(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  const publicConfig = getPublicSupabaseConfig();
  if (!publicConfig) return { response, session: null as ReturnType<typeof createServerClient> | null };

  const session = createServerClient(publicConfig.url, publicConfig.key, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  return { response, session };
}

export async function POST(request: Request) {
  if (!previewHostAllowed(request.headers.get("host") ?? "")) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }

  const config = getSupabaseServerConfig();
  const admin = createSupabaseServerClient();
  const publicConfig = getPublicSupabaseConfig();
  if (!config || !admin || !publicConfig) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const password = previewPassword();
  const { response, session } = jsonWithSessionCookies({ ok: true });
  if (!session) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  // Prefer an existing password so we do not invalidate an already-open preview session.
  let signedIn = await session.auth.signInWithPassword({ email: PREVIEW_EMAIL, password });
  if (signedIn.error || !signedIn.data.session) {
    const created = await admin.auth.admin.createUser({
      email: PREVIEW_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { locale: "ko", localPreview: true },
    });
    if (created.error) {
      const existingId = (created.data as { user?: { id?: string } | null } | null)?.user?.id
        ?? await userIdForEmail(config.url, config.key);
      if (!existingId) return NextResponse.json({ error: "unavailable" }, { status: 503 });
      const updated = await admin.auth.admin.updateUserById(existingId, { password, email_confirm: true });
      if (updated.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    signedIn = await session.auth.signInWithPassword({ email: PREVIEW_EMAIL, password });
  }

  if (signedIn.error || !signedIn.data.session) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  return response;
}
