import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const component = read("components/polaroid-entry.tsx");
const admissionRoute = read("app/api/seasonal-polaroid/route.ts");
const admission = read("lib/seasonal-polaroid-admission.ts");
const worker = read("app/api/internal/ai-worker/route.ts");
const save = read("app/api/account-result/seasonal-polaroid/route.ts");
const gallery = read("app/api/my-polaroids/route.ts");
const myPolaroidsPage = read("components/my-polaroids-page.tsx");
const galleryClient = read("lib/my-polaroids-client.ts");
const resultPersistence = read("lib/seasonal-polaroid-persistence.ts");
const resultSchema = read("supabase/migration_seasonal_polaroid_results.sql");
const durablePersistence = read("supabase/migration_seasonal_polaroid_durable_persistence.sql");
const memories = read("app/api/my/pets/[petId]/memories/route.ts");
const migration = read("supabase/drafts/20261106_003_seasonal_polaroid_pet_link.sql");
const polaroidPage = read("app/polaroid/page.tsx");

test("Pet-First entry securely loads the exact pet and skips known identity questions", () => {
  assert.match(component, /fetch\(`\/api\/my\/pets\/\$\{encodeURIComponent\(initialPetId\)\}`/);
  assert.match(component, /parseSeasonalPolaroidPetProfile\(body, initialPetId\)/);
  assert.match(component, /speciesId \? \{ species: speciesId \} : \{\}/);
  assert.match(component, /status \? \{ status \} : \{\}/);
  assert.match(component, /!selectedPet \? <div className="space-y-2">/);
  assert.match(component, /petId: response\.petId \?\? selectedPet\?\.petId/);
  assert.match(admissionRoute, /requireOwnedPet\(requestedPetId\)/);
  assert.match(admissionRoute, /access\.user\.id !== authenticatedUserId/);
  assert.match(admissionRoute, /selectedPet\.life_status === "memorial"\) answers\.status = "passed"/);
});

test("year-round Polaroid presents art style and an optional occasion, not legacy scene selections", () => {
  assert.match(component, /isEverydayPolaroidArtStyle\(answers\.themeId\)/);
  assert.match(component, /yearRoundEnabled \? \(/);
  assert.match(component, /data-polaroid-occasion-list=/);
  assert.match(component, /const ready = item\.implemented && isPolaroidOccasionAdmitted\(item\.id, themeFlags\)/);
  assert.match(component, /disabled=\{!ready\}/);
  assert.match(component, /const occasionReady = !answers\.occasionId/);
  assert.match(component, /occasionId: answers\.occasionId/);
  assert.match(component, /isArtStyleFlow \? undefined : answers\.costume/);
  assert.match(component, /isArtStyleFlow \? undefined : answers\.scene/);
  assert.match(component, /isArtStyleFlow \? undefined : answers\.vibe/);
  assert.doesNotMatch(component, /\bcostumeChoice\b|\bsceneChoice\b|\bvibeChoice\b/);
  assert.match(component, /sceneChoiceVersion === 2/);
  assert.match(component, /isPolaroidOccasionAdmitted\(draft\.occasionId, flags\)/);
});

test("Adoption Day selection stays intact from the UI and API through queue, worker, and durable metadata", () => {
  assert.match(component, /POLAROID_OCCASION_GROUPS\.flatMap\(\(group\) => group\.items\)/);
  assert.match(component, /occasionId: answers\.occasionId/);
  assert.match(admissionRoute, /occasionId: optionalText\(formData, "occasionId", 64\)/);
  assert.match(admissionRoute, /isPolaroidOccasionAdmitted\(String\(validation\.answers\.occasionId\)\)/);
  assert.match(admission, /occasionId: String\(answers\.occasionId \?\? ""\)\.trim\(\)/);
  assert.match(admission, /answers: normalized/);
  assert.match(worker, /occasionId: validated\.answers\.occasionId \|\| null/);
  assert.match(durablePersistence, /coalesce\(p_result->'generation', '\{\}'::jsonb\)/);
});

test("Polaroid route preserves an optional pet ID without changing the no-pet flow", () => {
  assert.match(polaroidPage, /const rawPet = params\.petId \?\? params\.pet/);
  assert.match(polaroidPage, /initialPetId=\{initialPetId\}/);
  assert.match(polaroidPage, /resumeDraft=\{resumeDraft\}/);
  assert.match(component, /if \(!initialPetId && resumeDraft\) \{[\s\S]{0,220}seasonalPolaroidDraftKey\(\)/);
  assert.match(component, /const loadKey = `\$\{initialPetId\}:\$\{authSession\.status\}:\$\{resumeDraft \? "resume" : "new"\}`/);
  assert.match(component, /\[applySavedPet, authSession\.status, initialPetId, resumeDraft\]/);
});

test("Pet-First profile application stays stable across pet and photo state updates", () => {
  assert.match(component, /const selectedPetIdRef = useRef<string \| null>\(selectedPet\?\.petId \?\? null\)/);
  assert.match(component, /if \(selectedPetIdRef\.current !== pet\.petId\) \{[\s\S]{0,180}photoRef\.current/);
  assert.match(component, /selectedPetIdRef\.current = pet\.petId;\s*setSelectedPet\(pet\)/);
  assert.match(component, /\}, \[resumeDraft, themeFlags, yearRoundEnabled\]\);/);
  assert.doesNotMatch(component, /from "@\/components\/pet-first-home"/);
  assert.match(component, /import \{ storyTabProps \} from "@\/lib\/story-tabs"/);
});

test("new Polaroid visits start without an art-style draft, while explicit resume restores it", () => {
  assert.match(polaroidPage, /resumeDraft = \(Array\.isArray\(rawResumeDraft\) \? rawResumeDraft\[0\] : rawResumeDraft\) === "1"/);
  assert.match(component, /if \(resumeDraft\) \{[\s\S]{0,220}seasonalPolaroidDraftKey\(pet\.petId\)/);
  assert.match(component, /if \(!initialPetId && resumeDraft\) \{[\s\S]{0,160}seasonalPolaroidDraftKey\(\)/);
  assert.match(component, /themeId: yearRoundEnabled \? "" : "halloween"/);
  assert.match(component, /if \(!hydrated \|\| resumeDraft\) return;[\s\S]{0,250}searchParams\.set\("resumeDraft", "1"\)/);
  assert.match(component, /answers\.themeId \? \([\s\S]{0,180}SeasonalPolaroidFrame/);
});

test("Pet identity survives idempotency, queue payload, worker result, and result saving", () => {
  assert.match(admission, /petId: args\.petId/);
  assert.match(admission, /args\.petId \? \{ \.\.\.request, petId: args\.petId\.toLowerCase\(\) \}/);
  assert.match(admission, /payload\.petId !== undefined/);
  assert.match(worker, /petId: payload\.petId \?\? null/);
  assert.match(save, /payloadPetId\?\.toLowerCase\(\).*resultPetId\?\.toLowerCase\(\)/);
  assert.match(save, /requestedPetId\?\.toLowerCase\(\).*verified\.petId\?\.toLowerCase\(\)/);
  assert.match(save, /requireOwnedPet\(verified\.petId\)/);
  assert.match(save, /pet_id: verified\.petId/);
  assert.match(save, /if \(verified\.petId\)[\s\S]{0,220}select\("owner_user_id, pet_id"\)/);
  assert.match(save, /else \{[\s\S]{0,180}select\("owner_user_id"\)/);
  assert.match(migration, /result_pet_id_text is distinct from queue_pet_id_text/);
  assert.match(migration, /existing_result\.pet_id is distinct from result_pet_id/);
});

test("Pet Polaroids remain owner-associated and are returned separately from the Memory Archive timeline", () => {
  assert.match(memories, /from\("seasonal_polaroid_results"\)/);
  assert.match(memories, /\.eq\("owner_user_id", access\.user\.id\)/);
  assert.match(memories, /\.eq\("pet_id", access\.pet\.pet_id\)/);
  assert.doesNotMatch(memories, /origin: "polaroid" as const/);
  assert.match(memories, /const polaroids = polaroidsSchemaRows\([\s\S]*?\.map\(\(result\) =>/);
  assert.match(memories, /return privateJson\(\{ timeline, letters, polaroids \}, 200\)/);
  assert.match(memories, /generation_metadata/);
  assert.match(memories, /occasionId: persistedPolaroidOccasionId\(result\.generation_metadata, result\.theme_id\)/);
  assert.match(myPolaroidsPage, /polaroidOccasionItem\(item\.occasionId\)/);
  assert.match(memories, /imageUrl: `\/api\/account-result\/seasonal-polaroid\?resultId=/);
  assert.match(memories, /polaroidSchemaMissing/);
});

test("empty art-style costume metadata is accepted through the result persistence and retrieval contracts", () => {
  assert.match(worker, /costumeId: seasonalPolaroidResultCostumeId\(promptAnswers\)/);
  assert.match(resultPersistence, /p_result:\s*result/);
  assert.match(durablePersistence, /coalesce\(p_result->>'costumeId', ''\)/);
  assert.match(migration, /coalesce\(p_result->>'costumeId', ''\)/);
  assert.match(resultSchema, /costume_id text not null default ''/);
  assert.doesNotMatch(resultSchema, /constraint [^,\n]*costume[^\n]*check/i);
  assert.match(gallery, /costumeId:\s*row\.costume_id/);
  assert.match(galleryClient, /typeof row\.costumeId !== "string"/);
  assert.match(gallery, /generation_metadata/);
  assert.match(gallery, /occasionId: persistedPolaroidOccasionId\(row\.generation_metadata, row\.theme_id\)/);
  assert.match(galleryClient, /occasionId: typeof row\.occasionId === "string" \? row\.occasionId : null/);
  assert.match(memories, /select\("result_id, pet_id, pet_name, theme_id, generation_metadata, memo_line_1/);
});

test("My Polaroids keeps the all-results gallery and offers an owner-checked pet filter", () => {
  assert.match(gallery, /requireOwnedPet\(requestedPetId\)/);
  assert.match(gallery, /\.eq\("pet_id", requestedPetId\)/);
  assert.match(gallery, /pet_id: null/);
  assert.match(component, /seasonalPolaroidDraftKey\(selectedPet\?\.petId\)/);
  assert.match(component, /seasonalPolaroidDraftKey\(pet\.petId\)/);
  assert.match(gallery, /\.eq\("owner_user_id", user\.id\)/);
});

test("the additive migration retains unlinked history and enforces result-to-pet ownership", () => {
  assert.match(migration, /add column if not exists pet_id uuid/);
  assert.match(migration, /references public\.soul_trace_pets\(pet_id\)\s+on delete set null/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /canonical_owner is distinct from new\.owner_user_id/);
  assert.match(migration, /owner_pet_created_idx/);
  assert.match(migration, /to_regprocedure\('public\.complete_seasonal_polaroid_job\(text,text,jsonb\)'\)\s+is null/i);
  assert.doesNotMatch(migration, /pg_get_function_identity_arguments/i);
  assert.match(migration, /create or replace function public\.complete_seasonal_polaroid_job/);
  assert.doesNotMatch(migration, /delete from public\.seasonal_polaroid_results/i);
  assert.doesNotMatch(migration, /update public\.seasonal_polaroid_results\s+set pet_id/i);
  assert.doesNotMatch(migration, /revoke all/i);
});

test("registered pet step shows a concise localized summary and offers switching only when useful", () => {
  const english = JSON.parse(read("locales/en.json"));
  const korean = JSON.parse(read("locales/ko.json"));
  assert.match(component, /\{selectedPet\.petName\}/);
  assert.match(component, /selectedPetSpecies\s*\?\s*t\(optionPath\(selectedPetSpecies\)\)/);
  assert.match(component, /seasonalPolaroid\.flow\.options\.status\.\$\{selectedPetStatus\}/);
  assert.match(component, /savedPets\.length && \(!selectedPet \|\| savedPets\.length > 1\)/);
  assert.match(component, /seasonalPolaroid\.flow\.yearRound\.changePet/);
  assert.doesNotMatch(component, /savedPetHint|usingPetProfile/);
  assert.equal(english.seasonalPolaroid.flow.yearRound.changePet, "Change pet");
  assert.equal(korean.seasonalPolaroid.flow.yearRound.changePet, "반려동물 변경");
  assert.equal(english.seasonalPolaroid.flow.yearRound.profileStatusNotSet, "Status not set");
  assert.equal(korean.seasonalPolaroid.flow.yearRound.profileStatusNotSet, "상태 미설정");
});

test("missing or unauthorized memory photos leave the normal picker and blank preview in place", () => {
  assert.match(component, /!initialMemoryAssetId/);
  assert.match(component, /if \(!response\.ok\) return;/);
  assert.match(component, /if \(current \|\| selectedPetIdRef\.current !== initialPetId\)/);
  assert.match(component, /const \[primaryPhoto, setPrimaryPhoto\] = useState<LocalPhoto \| null>\(null\)/);
  assert.match(component, /onChoose=\{openPhotoPicker\}/);
  assert.match(component, /primaryPhoto \? <img src=\{primaryPhoto\.url\}/);
  assert.match(component, /primaryPhoto \? <img src=\{primaryPhoto\.url\}[^\n]*: <div className="flex min-h-40/);
  assert.doesNotMatch(component, /CLEAN_ART|golden-retriever\.png/);
});
