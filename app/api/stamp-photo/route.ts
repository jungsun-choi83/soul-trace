import { looksLikeLetterId } from "@/lib/handoff";
import { validatePetPhotoFile } from "@/lib/pet-photo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { NextResponse } from "next/server";

const BUCKET = "soul-trace-stamp-photos";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  const letterId = form?.get("letterId");
  const stampType = form?.get("stampType");
  if (!looksLikeLetterId(letterId) || (stampType !== "photo" && stampType !== "paw")) {
    return NextResponse.json({ error: "Invalid stamp selection." }, { status: 400 });
  }

  const authClient = await createSupabaseAuthServerClient();
  const { data: authData } = authClient
    ? await authClient.auth.getUser()
    : { data: { user: null } };
  const normalizedEmail = authData.user?.email?.trim().toLowerCase() ?? "";
  if (!authData.user || !normalizedEmail) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  const { data: profile } = await supabase.from("soul_trace_profiles")
    .select("letter_id").eq("letter_id", letterId).eq("user_email", normalizedEmail).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Letter not found." }, { status: 404 });

  let stampPhotoRef: string | null = null;
  if (stampType === "photo") {
    const photo = form.get("stampPhoto");
    if (!(photo instanceof File) || validatePetPhotoFile(photo)) {
      return NextResponse.json({ error: "Invalid stamp photo." }, { status: 400 });
    }
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" :
      photo.type === "image/heic" ? "heic" : photo.type === "image/heif" ? "heif" : "jpg";
    stampPhotoRef = `letters/${letterId}/stamp.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(stampPhotoRef, await photo.arrayBuffer(), { contentType: photo.type || "image/jpeg", upsert: true });
    if (uploadError) return NextResponse.json({ error: "Could not save stamp photo." }, { status: 503 });
  }

  const { error } = await supabase.from("soul_trace_profiles")
    .update({ stamp_type: stampType, stamp_photo_ref: stampPhotoRef })
    .eq("letter_id", letterId).eq("user_email", normalizedEmail);
  if (error) return NextResponse.json({ error: "Could not save stamp selection." }, { status: 503 });
  return NextResponse.json({ stampType, stampPhotoRef });
}
