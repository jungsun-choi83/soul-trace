import { loadPetHome, type HomePet, type HomeRecent } from "./pet-first-archive-data.ts";
import { ensureOwnerRow } from "./pet-first-archive-server.ts";
import { createSupabaseAuthServerClient } from "./supabase-auth-server.ts";

export type EntryHomeData = {
  signedIn: boolean;
  pets: HomePet[];
  recent: HomeRecent[];
};

export async function loadEntryHome(): Promise<EntryHomeData> {
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return { signedIn: false, pets: [], recent: [] };
  await ensureOwnerRow(supabase, user.id);
  const home = await loadPetHome(supabase, user.id);
  return { signedIn: true, pets: home?.pets ?? [], recent: home?.recent ?? [] };
}
