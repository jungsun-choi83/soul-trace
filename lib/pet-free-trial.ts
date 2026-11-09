export const FREE_POLAROID_GRANT = "polaroid_first" as const;
export const FREE_STYLES = ["felt-doll", "gouache-story", "crayon-diary"] as const;
export const GUEST_PET_LIMIT = 1;
export const FREE_GRANT_DAILY_CAP = 3;
export const GUEST_STARTS_PER_HOUR = 5;
export const GUEST_RETENTION_MS = 72 * 60 * 60 * 1000;

export type FreeStyle = (typeof FREE_STYLES)[number];
export type TrialActor = { userId: string | null; guestSessionId: string | null };
export type TrialError =
  | "invalid"
  | "forbidden"
  | "exhausted"
  | "deleted"
  | "rate_limited"
  | "guest_limit"
  | "withheld";

type EntitlementStatus = "available" | "reserved" | "consumed";

type PetRecord = {
  petId: string;
  name: string;
  photoRevision: number;
  ownerUserId: string | null;
  guestSessionId: string | null;
  deletedAt: string | null;
  createdAt: string;
};

type Entitlement = {
  petId: string;
  status: EntitlementStatus;
  idempotencyKey: string | null;
  jobId: string | null;
};

type Job = {
  jobId: string;
  petId: string;
  style: FreeStyle;
  status: "reserved" | "succeeded" | "failed";
  idempotencyKey: string;
};

export type TrialReservation = {
  petId: string;
  jobId: string;
  style: FreeStyle;
  remaining: number;
  replayed: boolean;
};

function ownedBy(pet: PetRecord, actor: TrialActor): boolean {
  if (pet.ownerUserId && actor.userId && pet.ownerUserId === actor.userId) return true;
  return !pet.ownerUserId && !!pet.guestSessionId && pet.guestSessionId === actor.guestSessionId;
}

export function isFreeStyle(value: unknown): value is FreeStyle {
  return FREE_STYLES.includes(value as FreeStyle);
}

export class FreeTrialLedger {
  private pets = new Map<string, PetRecord>();
  private grants = new Map<string, Entitlement>();
  private jobs = new Map<string, Job>();
  private jobsByKey = new Map<string, string>();
  private starts: { key: string; at: number }[] = [];
  private ids: () => string;

  constructor(ids?: () => string) {
    this.ids = ids ?? (() => crypto.randomUUID());
  }

  pet(petId: string): PetRecord | null {
    return this.pets.get(petId) ?? null;
  }

  remaining(petId: string): number {
    if (!this.pets.has(petId)) return 0;
    const grant = this.grants.get(petId);
    if (!grant || grant.status !== "available") return 0;
    return 1;
  }

  registerPet(input: {
    actor: TrialActor;
    name: string;
    now: number;
    ipKey: string;
    petId?: string;
  }): { ok: true; petId: string; remaining: number } | { ok: false; error: TrialError } {
    const name = input.name.trim().replace(/\s+/g, " ");
    if (!name || name.length > 40) return { ok: false, error: "invalid" };
    if (!input.actor.userId && !input.actor.guestSessionId) return { ok: false, error: "forbidden" };
    this.purge(input.now);

    if (input.petId) {
      const existing = this.pets.get(input.petId);
      if (!existing || !ownedBy(existing, input.actor)) return { ok: false, error: "forbidden" };
      if (existing.deletedAt) return { ok: false, error: "deleted" };
      return { ok: true, petId: existing.petId, remaining: this.remaining(existing.petId) };
    }

    if (!input.actor.userId) {
      const guestPets = [...this.pets.values()].filter((pet) => pet.guestSessionId === input.actor.guestSessionId);
      if (guestPets.length >= GUEST_PET_LIMIT) {
        const current = guestPets.find((pet) => !pet.deletedAt) ?? guestPets[0];
        if (!current || current.deletedAt) return { ok: false, error: "deleted" };
        return { ok: true, petId: current.petId, remaining: this.remaining(current.petId) };
      }
    }
    if (!this.allowStart(input.ipKey, input.now)) return { ok: false, error: "rate_limited" };
    if (input.actor.userId && this.grantsToday(input.actor.userId, input.now) >= FREE_GRANT_DAILY_CAP) {
      return { ok: false, error: "withheld" };
    }

    const petId = this.ids();
    this.pets.set(petId, {
      petId,
      name,
      photoRevision: 1,
      ownerUserId: input.actor.userId,
      guestSessionId: input.actor.userId ? null : input.actor.guestSessionId,
      deletedAt: null,
      createdAt: new Date(input.now).toISOString(),
    });
    this.grants.set(petId, { petId, status: "available", idempotencyKey: null, jobId: null });
    this.starts.push({ key: input.ipKey, at: input.now });
    return { ok: true, petId, remaining: 1 };
  }

  attachOwnedPet(input: { petId: string; userId: string; name: string; now: number; enforceCap: boolean }): number {
    const existing = this.pets.get(input.petId);
    if (existing) {
      if (existing.ownerUserId && existing.ownerUserId !== input.userId) return 0;
      existing.ownerUserId = input.userId;
      return this.remaining(input.petId);
    }
    const blocked = input.enforceCap && this.grantsToday(input.userId, input.now) >= FREE_GRANT_DAILY_CAP;
    this.pets.set(input.petId, {
      petId: input.petId,
      name: input.name.trim() || "우리 아이",
      photoRevision: 1,
      ownerUserId: input.userId,
      guestSessionId: null,
      deletedAt: null,
      createdAt: new Date(input.now).toISOString(),
    });
    if (blocked) return 0;
    this.grants.set(input.petId, { petId: input.petId, status: "available", idempotencyKey: null, jobId: null });
    return 1;
  }

  rename(petId: string, actor: TrialActor, name: string): TrialError | null {
    const pet = this.pets.get(petId);
    if (!pet || !ownedBy(pet, actor)) return "forbidden";
    const next = name.trim();
    if (!next || next.length > 40) return "invalid";
    pet.name = next;
    return null;
  }

  replacePhoto(petId: string, actor: TrialActor): TrialError | null {
    const pet = this.pets.get(petId);
    if (!pet || !ownedBy(pet, actor)) return "forbidden";
    pet.photoRevision += 1;
    return null;
  }

  reserve(input: {
    petId: string;
    actor: TrialActor;
    style: FreeStyle;
    idempotencyKey: string;
  }): { ok: true; reservation: TrialReservation } | { ok: false; error: TrialError } {
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.idempotencyKey)) return { ok: false, error: "invalid" };
    const pet = this.pets.get(input.petId);
    if (!pet || !ownedBy(pet, input.actor)) return { ok: false, error: "forbidden" };
    if (pet.deletedAt) return { ok: false, error: "deleted" };
    const priorId = this.jobsByKey.get(input.idempotencyKey);
    if (priorId) {
      const prior = this.jobs.get(priorId);
      if (!prior || prior.petId !== pet.petId) return { ok: false, error: "forbidden" };
      return {
        ok: true,
        reservation: { petId: pet.petId, jobId: prior.jobId, style: prior.style, remaining: this.remaining(pet.petId), replayed: true },
      };
    }
    const grant = this.grants.get(pet.petId);
    if (!grant || grant.status !== "available") return { ok: false, error: "exhausted" };
    const jobId = this.ids();
    grant.status = "reserved";
    grant.idempotencyKey = input.idempotencyKey;
    grant.jobId = jobId;
    const job: Job = { jobId, petId: pet.petId, style: input.style, status: "reserved", idempotencyKey: input.idempotencyKey };
    this.jobs.set(jobId, job);
    this.jobsByKey.set(input.idempotencyKey, jobId);
    return {
      ok: true,
      reservation: { petId: pet.petId, jobId, style: input.style, remaining: 0, replayed: false },
    };
  }

  succeed(jobId: string): TrialError | null {
    const job = this.jobs.get(jobId);
    const grant = job ? this.grants.get(job.petId) : null;
    if (!job || !grant || grant.jobId !== jobId || job.status === "failed") return "invalid";
    job.status = "succeeded";
    grant.status = "consumed";
    return null;
  }

  fail(jobId: string): TrialError | null {
    const job = this.jobs.get(jobId);
    const grant = job ? this.grants.get(job.petId) : null;
    if (!job || !grant || grant.jobId !== jobId) return "invalid";
    if (grant.status === "consumed") return "invalid";
    job.status = "failed";
    grant.status = "available";
    grant.jobId = null;
    grant.idempotencyKey = null;
    this.jobsByKey.delete(job.idempotencyKey);
    return null;
  }

  claim(guestSessionId: string, userId: string): string[] {
    const moved: string[] = [];
    for (const pet of this.pets.values()) {
      if (pet.guestSessionId !== guestSessionId || pet.ownerUserId) continue;
      pet.ownerUserId = userId;
      pet.guestSessionId = null;
      moved.push(pet.petId);
    }
    return moved;
  }

  deletePet(petId: string, actor: TrialActor, now: number): TrialError | null {
    const pet = this.pets.get(petId);
    if (!pet || !ownedBy(pet, actor)) return "forbidden";
    pet.deletedAt = new Date(now).toISOString();
    return null;
  }

  restorePet(petId: string, actor: TrialActor): TrialError | null {
    const pet = this.pets.get(petId);
    if (!pet || !ownedBy(pet, actor)) return "forbidden";
    pet.deletedAt = null;
    return null;
  }

  purge(now: number): void {
    for (const pet of this.pets.values()) {
      if (pet.ownerUserId) continue;
      if (now - Date.parse(pet.createdAt) < GUEST_RETENTION_MS) continue;
      this.pets.delete(pet.petId);
    }
    this.starts = this.starts.filter((item) => now - item.at < 60 * 60 * 1000);
  }

  private allowStart(ipKey: string, now: number): boolean {
    const recent = this.starts.filter((item) => item.key === ipKey && now - item.at < 60 * 60 * 1000);
    return recent.length < GUEST_STARTS_PER_HOUR;
  }

  private grantsToday(userId: string, now: number): number {
    return [...this.pets.values()].filter((pet) => pet.ownerUserId === userId && now - Date.parse(pet.createdAt) < 24 * 60 * 60 * 1000).length;
  }
}

const LEDGER_VERSION = 2;
const globalLedger = globalThis as typeof globalThis & { __soultraceFreeTrial?: { version: number; ledger: FreeTrialLedger } };

export function trialLedger(): FreeTrialLedger {
  if (!globalLedger.__soultraceFreeTrial || globalLedger.__soultraceFreeTrial.version !== LEDGER_VERSION) {
    globalLedger.__soultraceFreeTrial = { version: LEDGER_VERSION, ledger: new FreeTrialLedger() };
  }
  return globalLedger.__soultraceFreeTrial.ledger;
}
