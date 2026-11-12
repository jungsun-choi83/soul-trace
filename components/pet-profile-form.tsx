"use client";

import { useLocale } from "@/components/locale-provider";
import { statusLabel } from "@/components/pet-first-home";
import { StoryState } from "@/components/storybook/story-state";
import { splitPetNotes, type LifeStatus } from "@/lib/pet-first-archive";
import { petCreationContinuePath } from "@/lib/auth-redirect";
import { petFirstCopy } from "@/lib/storybook-copy";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

export function PetProfileForm({
  mode,
  petId,
  continueTo = null,
  initial,
  initialError = null,
}: {
  mode: "create" | "edit";
  petId?: string;
  continueTo?: string | null;
  initialError?: "profile" | "photo" | null;
  initial?: {
    petName: string;
    lifeStatus: LifeStatus;
    species: string | null;
    birthday: string | null;
    adoptedOn: string | null;
    traits: string | null;
  };
}) {
  const router = useRouter();
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const notes = splitPetNotes(initial?.traits ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<"profile" | "photo" | null>(initialError);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") === "status" || window.location.hash === "#status") {
      document.getElementById("status")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      petName: data.get("petName"),
      species: data.get("species"),
      birthday: data.get("birthday"),
      adoptedOn: data.get("adoptedOn"),
      lifeStatus: data.get("lifeStatus"),
      traits: data.get("traits"),
      favorites: data.get("favorites"),
    };
    try {
      const response = await fetch(mode === "create" ? "/api/my/pets" : `/api/my/pets/${petId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError("profile");
        setSaving(false);
        return;
      }
      const saved = await response.json() as { petId: string };
      const photo = data.get("photo");
      if (photo instanceof File && photo.size > 0) {
        const upload = new FormData();
        upload.set("photos", photo);
        upload.set("caption", copy.profilePhoto);
        let uploaded = false;
        try {
          uploaded = (await fetch(`/api/my/pets/${saved.petId}/photos`, { method: "POST", body: upload })).ok;
        } catch {
          uploaded = false;
        }
        if (!uploaded) {
          setSaving(false);
          setError("photo");
          if (mode === "create") {
            const params = new URLSearchParams({ photoError: "1" });
            if (continueTo) params.set("continueTo", continueTo);
            router.push(`/my/pets/${encodeURIComponent(saved.petId)}/edit?${params.toString()}`);
          }
          return;
        }
      }
      setSaving(false);
      const continuation = petCreationContinuePath(continueTo, saved.petId);
      router.push(continuation ?? `/dashboard?pet=${encodeURIComponent(saved.petId)}`);
      router.refresh();
    } catch {
      setSaving(false);
      setError("profile");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-busy={saving}>
      <Field id="pet-name" label={copy.name} hint={copy.required} strong>
        <input id="pet-name" name="petName" required maxLength={40} defaultValue={initial?.petName ?? ""} autoComplete="nickname" placeholder={copy.namePlaceholder} className="st-field" />
      </Field>
      <p className="-mt-2 text-xs text-[color:var(--st-text-soft)]">{copy.sameNameHint}</p>
      <Field id="pet-photo" label={copy.profilePhoto} hint={copy.optional}>
        <input id="pet-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="st-field" />
      </Field>
      <Field id="pet-species" label={copy.species} hint={copy.optional}>
        <input id="pet-species" name="species" maxLength={40} defaultValue={initial?.species ?? ""} placeholder={copy.speciesPlaceholder} className="st-field" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pet-birthday" label={copy.birthday} hint={copy.optional}>
          <input id="pet-birthday" name="birthday" type="date" defaultValue={initial?.birthday ?? ""} className="st-field" />
        </Field>
        <Field id="pet-adopted" label={copy.adopted} hint={copy.optional}>
          <input id="pet-adopted" name="adoptedOn" type="date" defaultValue={initial?.adoptedOn ?? ""} className="st-field" />
        </Field>
      </div>
      <fieldset id="status">
        <legend className="text-sm font-medium">{copy.status}</legend>
        <div className="mt-2 grid gap-2">
          {(["living", "memorial", "unspecified"] as LifeStatus[]).map((value) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--st-field-edge)] bg-[color:var(--st-field)] px-4 text-sm has-[:checked]:border-[color:var(--st-sage-deep)] has-[:checked]:bg-[color:var(--st-sage)]/15">
              <input type="radio" name="lifeStatus" value={value} defaultChecked={(initial?.lifeStatus ?? "unspecified") === value} className="accent-[color:var(--st-sage-deep)]" />
              {statusLabel(copy, value)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="pet-traits" label={copy.traits} hint={copy.optional}>
        <textarea id="pet-traits" name="traits" maxLength={400} rows={3} defaultValue={notes.personality ?? ""} placeholder={copy.traitsPlaceholder} className="st-field" />
      </Field>
      <Field id="pet-favorites" label={copy.favorites} hint={copy.optional}>
        <textarea id="pet-favorites" name="favorites" maxLength={200} rows={2} defaultValue={notes.favorites ?? ""} placeholder={copy.favoritesPlaceholder} className="st-field" />
      </Field>
      {error ? <StoryState kind="error" title={error === "photo" ? copy.savePetPhotoError : copy.savePetError} /> : null}
      <button type="submit" disabled={saving} className="st-btn st-btn-primary w-full">
        {saving ? copy.saving : mode === "create" ? copy.startPetSpace : copy.editPet}
      </button>
    </form>
  );
}

function Field({ id, label, hint, strong = false, children }: { id: string; label: string; hint: string; strong?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} <span className={strong ? "text-[color:var(--st-brown)]" : "font-normal text-[color:var(--st-text-soft)]"}>({hint})</span>
      </label>
      {children}
    </div>
  );
}
