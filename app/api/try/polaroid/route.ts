import { readFile } from "node:fs/promises";
import path from "node:path";

import { trialPlateSrc } from "@/components/trial-theme-scene";
import { isFreeStyle, trialLedger, type FreeStyle, type TrialActor } from "@/lib/pet-free-trial";
import { isUuid } from "@/lib/pet-first-archive";
import { generateTrialPolaroidImage, isTrialTheme, type TrialThemeId } from "@/lib/trial-polaroid-ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 120;

const COOKIE = "st_guest_trial";
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const artworkStore = globalThis as typeof globalThis & { __soultraceTrialArt?: Map<string, string> };

function savedArtwork() {
  artworkStore.__soultraceTrialArt ??= new Map();
  return artworkStore.__soultraceTrialArt;
}

function actorFrom(guestSessionId: string): TrialActor {
  return { userId: null, guestSessionId };
}

async function plateReference(style: FreeStyle, theme: TrialThemeId) {
  const src = trialPlateSrc(style, theme);
  if (!src) return null;
  const file = path.join(process.cwd(), "public", ...src.split("/").filter(Boolean));
  const bytes = await readFile(file);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return { bytes: copy, name: path.basename(file), type: "image/jpeg" };
}

export async function POST(request: Request) {
  const form = await request.formData();
  const style = form.get("style");
  const theme = String(form.get("occasionId") ?? "");
  const name = String(form.get("petName") ?? "");
  const key = String(form.get("idempotencyKey") ?? "");
  const requestedPet = String(form.get("petId") ?? "");
  const photo = form.get("photo");
  if (!isFreeStyle(style) || !isTrialTheme(theme) || !(photo instanceof File) || !PHOTO_TYPES.has(photo.type) || photo.size < 1 || photo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const existing = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const guestSessionId = existing && isUuid(existing) ? existing : crypto.randomUUID();
  const actor = actorFrom(guestSessionId);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const book = trialLedger();
  const registered = book.registerPet({
    actor,
    name,
    now: Date.now(),
    ipKey: ip,
    petId: isUuid(requestedPet) ? requestedPet : undefined,
  });
  if (!registered.ok) {
    const status = registered.error === "rate_limited" ? 429 : registered.error === "forbidden" ? 404 : 409;
    return NextResponse.json({ error: registered.error }, { status });
  }
  const reserved = book.reserve({ petId: registered.petId, actor, style, idempotencyKey: key });
  if (!reserved.ok) {
    const status = reserved.error === "forbidden" ? 404 : 409;
    return NextResponse.json({ error: reserved.error }, { status });
  }

  const jobId = reserved.reservation.jobId;
  let image = savedArtwork().get(jobId) ?? null;
  if (!reserved.reservation.replayed) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const plate = apiKey ? await plateReference(style, theme) : null;
    if (!apiKey || !plate) {
      book.fail(jobId);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    try {
      const generated = await generateTrialPolaroidImage({
        openai: new OpenAI({ apiKey }),
        pet: { bytes: await photo.arrayBuffer(), name: photo.name || "pet.jpg", type: photo.type },
        plate,
        style,
        theme,
      });
      image = generated.imageBase64;
    } catch (error) {
      console.error("[try-polaroid]", error instanceof Error ? error.name : "error");
      image = null;
    }
    if (!image) {
      book.fail(jobId);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    const charged = book.succeed(jobId);
    if (charged) {
      book.fail(jobId);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    savedArtwork().set(jobId, image);
  }
  if (!image) return NextResponse.json({ error: "failed" }, { status: 500 });

  const response = NextResponse.json({
    petId: reserved.reservation.petId,
    jobId,
    style: reserved.reservation.style,
    remaining: book.remaining(reserved.reservation.petId),
    image,
  });
  if (!existing) {
    response.cookies.set(COOKIE, guestSessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  }
  return response;
}
