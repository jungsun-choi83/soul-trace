import { cookies } from "next/headers";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getDurableFreeTrialResult, FREE_TRIAL_GUEST_COOKIE } from "@/lib/free-trial-persistence-server";

export async function GET(_request: Request, context: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await context.params;
  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  const cookieStore = await cookies();
  const blob = await getDurableFreeTrialResult({
    resultId,
    guestCookie: cookieStore.get(FREE_TRIAL_GUEST_COOKIE)?.value,
    userId: user?.id ?? null,
  });
  if (!blob) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(blob, {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
