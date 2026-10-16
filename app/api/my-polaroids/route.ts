import { NextResponse } from "next/server";

import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Returns only the authenticated user's safe Seasonal Polaroid metadata.
 * Image object keys are deliberately kept server-side; the existing private
 * result endpoint is used to retrieve each image after authentication.
 */
export async function GET(): Promise<Response> {
  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const db = createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("seasonal_polaroid_results")
    .select(
      "result_id, pet_name, species, status, theme_id, costume_id, memo_line_1, memo_line_2, memo_line_3, memo_line_4, memo_locale, created_at",
    )
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  return NextResponse.json({
    results: (data ?? []).map((row) => ({
      resultId: row.result_id,
      petName: row.pet_name,
      species: row.species,
      status: row.status,
      themeId: row.theme_id,
      costumeId: row.costume_id,
      memoLines: [row.memo_line_1, row.memo_line_2, row.memo_line_3, row.memo_line_4],
      memoLocale: row.memo_locale,
      createdAt: row.created_at,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
