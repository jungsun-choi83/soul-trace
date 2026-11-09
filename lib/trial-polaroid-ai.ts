import type OpenAI from "openai";

import type { FreeStyle } from "./pet-free-trial.ts";
import {
  generatePetReferenceImage,
  type PetImageReference,
  type VisualMemoryImageGenerationResult,
} from "./visual-memory-ai.ts";

export const TRIAL_THEME_IDS = [
  "christmas-village",
  "spring-picnic",
  "summer-beach",
  "autumn-walk",
  "birthday-room",
  "first-snow-street",
] as const;

export type TrialThemeId = (typeof TRIAL_THEME_IDS)[number];

export type TrialPlatePreset = {
  themeId: TrialThemeId;
  petAnchorX: number;
  petAnchorY: number;
  petMaxWidth: number;
  petMaxHeight: number;
  foregroundOverlay: null;
  ground: string;
  snowContact: boolean;
};

/** Relative placement on the center path. Fractions of the frame, not pixels. */
export const TRIAL_PLATE_PRESETS: Record<TrialThemeId, TrialPlatePreset> = {
  "christmas-village": { themeId: "christmas-village", petAnchorX: 0.5, petAnchorY: 0.74, petMaxWidth: 0.34, petMaxHeight: 0.52, foregroundOverlay: null, ground: "the snowy village path", snowContact: true },
  "spring-picnic": { themeId: "spring-picnic", petAnchorX: 0.5, petAnchorY: 0.72, petMaxWidth: 0.34, petMaxHeight: 0.5, foregroundOverlay: null, ground: "the picnic path", snowContact: false },
  "summer-beach": { themeId: "summer-beach", petAnchorX: 0.5, petAnchorY: 0.7, petMaxWidth: 0.36, petMaxHeight: 0.5, foregroundOverlay: null, ground: "the resort path", snowContact: false },
  "autumn-walk": { themeId: "autumn-walk", petAnchorX: 0.5, petAnchorY: 0.73, petMaxWidth: 0.32, petMaxHeight: 0.52, foregroundOverlay: null, ground: "the autumn path", snowContact: false },
  "birthday-room": { themeId: "birthday-room", petAnchorX: 0.5, petAnchorY: 0.7, petMaxWidth: 0.34, petMaxHeight: 0.5, foregroundOverlay: null, ground: "the party-room floor", snowContact: false },
  "first-snow-street": { themeId: "first-snow-street", petAnchorX: 0.5, petAnchorY: 0.74, petMaxWidth: 0.32, petMaxHeight: 0.52, foregroundOverlay: null, ground: "the first-snow street", snowContact: true },
};

const STYLE_BRIEF: Record<FreeStyle, string> = {
  "gouache-story": [
    "MEDIUM: hand-painted gouache. Soft but clear brushstrokes, opaque paint, the same color temperature and shadow handling as the background illustration.",
    "Redraw the pet with visible gouache paint. Do not leave any photographic fur, flash, or camera texture.",
  ].join("\n"),
  "felt-doll": [
    "MEDIUM: needle-felted wool. Visible wool fibers, soft handmade volume, a craft miniature that matches the felt background's scale and perspective.",
    "Do not render a plastic toy, a 3D animated character, or a photograph.",
  ].join("\n"),
  "crayon-diary": [
    "MEDIUM: the background's pastel vintage travel-poster illustration. Crisp delicate outlines, restrained pastel color, flat color with refined shading.",
    "No watercolor bleed, no anime, no photographic texture. The pet is drawn in that same poster style.",
  ].join("\n"),
};

export function isTrialTheme(value: string): value is TrialThemeId {
  return (TRIAL_THEME_IDS as readonly string[]).includes(value);
}

export function buildTrialPolaroidPrompt(style: FreeStyle, theme: TrialThemeId): string {
  const preset = TRIAL_PLATE_PRESETS[theme];
  const width = Math.round(preset.petMaxWidth * 100);
  const height = Math.round(preset.petMaxHeight * 100);
  const down = Math.round(preset.petAnchorY * 100);
  return [
    "Create one finished illustration. The first image is the real pet and is only an identity reference. The second image is the finished background and must stay the background.",
    "The pet and the background must look like one illustration in the same medium. A cutout photograph pasted onto the artwork is forbidden. Do not place a rectangle, frame, or photo edge around the pet. Do not cut a hole or a black region out of the background.",
    STYLE_BRIEF[style],
    "Keep the background artwork itself: the same buildings, trees, path, decorations, and framing. Do not redraw the scene, do not move the buildings, and do not add text, letters, a border, or a polaroid frame.",
    `Place the restyled pet on ${preset.ground}, at the horizontal center, with the paws about ${down}% of the way down the picture and slightly below the middle of the path.`,
    `The full pet must be visible: head, ears, tail, and paws are not cropped. Fit the pet inside about ${width}% of the frame width and ${height}% of the frame height, scaled to the path's perspective. A small pet stays smaller; a large pet may be larger, but it must not cover the main buildings.`,
    "The paws stand or sit on the ground. Add a soft contact shadow that matches the background light. Match the background's perspective and color temperature.",
    preset.snowContact ? "This is a snowy path. Add a light natural snow contact around the paws. Do not bury the pet." : "Do not add snow.",
    "Preserve this individual pet: breed and build, coat colors and markings, ear shape, eye and nose character, face, body proportions, and a collar or other clear accessory if the photo shows one.",
    "Do not swap the breed, invent a smile, add a hat, or add a costume. No Christmas outfit unless it is already in the photo.",
    "Identity matters more than cuteness. The result is the same pet, redrawn into the background, not a different cute animal and not the original photo laid on top.",
    "FINAL CHECK: Fur, eyes, nose, ears, paws, and any leash must be drawn with the same marks as the background. A photographic animal standing inside an illustration is a failed image. Repaint the whole pet in that medium until no camera texture remains.",
  ].join("\n");
}

export async function generateTrialPolaroidImage({
  openai,
  pet,
  plate,
  style,
  theme,
}: {
  openai: OpenAI;
  pet: PetImageReference;
  plate: PetImageReference;
  style: FreeStyle;
  theme: TrialThemeId;
}): Promise<VisualMemoryImageGenerationResult> {
  return generatePetReferenceImage({
    openai,
    references: [pet, plate],
    prompt: buildTrialPolaroidPrompt(style, theme),
    size: "1536x1024",
    quality: "high",
    logLabel: "trial-polaroid",
  });
}
