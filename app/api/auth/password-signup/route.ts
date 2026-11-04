import { normalizeAuthEmail, normalizeAuthLocale } from "@/lib/passwordless-auth";
import { passwordValidationError } from "@/lib/password-recovery";
import { createSupabaseServerClient, getSupabaseServerConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function alreadyRegistered(code: string, message: string) {
  const haystack = `${code} ${message}`.toLowerCase();
  return haystack.includes("already") || haystack.includes("email_exists") || haystack.includes("user_already_exists");
}

async function userIdForEmail(url: string, key: string, email: string) {
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { users?: { id?: string }[]; id?: string };
  if (typeof payload.id === "string") return payload.id;
  return payload.users?.find((user) => typeof user.id === "string")?.id ?? null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizeAuthEmail(typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || passwordValidationError(password, password)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const config = getSupabaseServerConfig();
  const admin = createSupabaseServerClient();
  if (!config || !admin) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const locale = normalizeAuthLocale(body?.locale);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { locale },
  });
  if (!created.error) {
    return NextResponse.json({ ok: true });
  }

  const code = String(created.error.code ?? "");
  const message = String(created.error.message ?? "");
  if (!alreadyRegistered(code, message)) {
    return NextResponse.json({ error: code === "weak_password" ? "policy_failed" : "request_failed" }, { status: 400 });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const browser = createClient(config.url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signin = await browser.auth.signInWithPassword({ email, password });
  if (signin.data.session) {
    return NextResponse.json({ ok: true });
  }
  if (String(signin.error?.code ?? "") !== "email_not_confirmed") {
    return NextResponse.json({ error: "already_registered" }, { status: 409 });
  }

  const userId = signin.data.user?.id ?? await userIdForEmail(config.url, config.key, email);
  if (!userId) {
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }
  const confirmed = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (confirmed.error) {
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
