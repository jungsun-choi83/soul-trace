import "server-only";

import { aiGenerationIdempotencyKey } from "@/lib/ai-generation-guard";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Associate a newly admitted Seasonal job with the already-authenticated
 * account that created it. The caller must pass the server-verified user ID;
 * this helper never reads an ID from form data or the browser.
 */
export async function attachSeasonalPolaroidJobOwner(args: {
  jobId: string;
  ownerUserId: string;
  ownerIdentityHash: string;
}): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("attach_seasonal_polaroid_job_owner", {
    p_job_id: args.jobId,
    p_owner_user_id: args.ownerUserId,
    p_owner_identity_hash: args.ownerIdentityHash,
  });
  if (error) {
    console.error("[seasonal-persistence] owner association failed", { code: error.code });
    return false;
  }
  return data === true;
}

export async function detachSeasonalPolaroidJobOwner(jobId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("seasonal_polaroid_job_owners")
    .delete()
    .eq("job_id", jobId);
  if (error) console.error("[seasonal-persistence] owner cleanup failed", { code: error.code });
}

/**
 * Complete a Seasonal job only after the same transaction has persisted its
 * authenticated owner's gallery row. Developer-only jobs have no owner hash
 * and are explicitly allowed to complete without a gallery row.
 */
export async function completeSeasonalPolaroidJob(
  requestHash: string,
  result: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("complete_seasonal_polaroid_job", {
    p_idempotency_key: await aiGenerationIdempotencyKey("seasonal_polaroid", requestHash),
    p_request_hash: requestHash,
    p_result: result,
  });
  if (error) {
    console.error("[seasonal-persistence] result completion failed", { code: error.code });
    return false;
  }
  return data === true;
}
