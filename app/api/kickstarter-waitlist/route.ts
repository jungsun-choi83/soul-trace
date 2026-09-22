import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) {
    return Response.json({ error: "Invalid request." }, { status: 413 });
  }

  let body: { email?: unknown; locale?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot submissions receive a neutral response without touching storage.
  if (typeof body.website === "string" && body.website) {
    return Response.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = body.locale === "ko" ? "ko" : "en";
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    console.error("[kickstarter-waitlist] Supabase configuration is missing");
    return Response.json({ error: "Waitlist is temporarily unavailable." }, { status: 503 });
  }

  const { error } = await supabase
    .from("kickstarter_waitlist")
    .upsert({ email, locale }, { onConflict: "email", ignoreDuplicates: false });

  if (error) {
    console.error("[kickstarter-waitlist] Unable to store signup", {
      code: error.code,
      message: error.message,
    });
    return Response.json({ error: "Waitlist is temporarily unavailable." }, { status: 503 });
  }

  return Response.json({ ok: true });
}
