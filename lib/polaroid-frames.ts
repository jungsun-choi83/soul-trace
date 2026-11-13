export const HALLOWEEN_POLAROID_FRAME_SRC = "/images/soul_trace_seasonal_polaroid_blank_caption_template.png";
/** The original JPG is retained; the transparent overlay keeps felt flowers above the photo. */
export const FELT_POLAROID_FRAME_ART_SRC = "/images/polaroid/frame-felt.jpg";
export const FELT_POLAROID_FRAME_SRC = "/images/polaroid/frame-felt-overlay.png";
/** The supplied PNG is kept untouched and used as the source for the alpha-matted overlay. */
export const GOUACHE_POLAROID_FRAME_ART_SRC = "/images/polaroid/black inner floral storybook card.png";
/** Alpha-matted copy of the supplied PNG; original frame pixels remain unchanged. */
export const GOUACHE_POLAROID_FRAME_SRC = "/images/polaroid/black inner floral storybook card-overlay.png";
/** The original JPG is retained; its transparent overlay restores the hand-drawn opening edge above the photo. */
export const CRAYON_POLAROID_FRAME_ART_SRC = "/images/polaroid/frame-crayon.jpg";
export const CRAYON_POLAROID_FRAME_SRC = "/images/polaroid/frame-crayon-overlay.png";

export type PolaroidFrameLayout = {
  id: "halloween" | "felt" | "gouache" | "crayon";
  templateSrc: string;
  templateOverlay?: boolean;
  templateObjectFit?: "contain";
  photo: { left: string; top: string; width: string; height: string };
  photoPlaceholderTextColor?: string;
  caption: { left: string; right: string; top: string; bottom: string };
  captionSurface?: string;
  captionPadding?: string;
  captionRadius?: string;
  captionFontSize?: string;
  captionTextColor?: string;
  photoRadius: string;
  flowers: boolean;
  halloweenDecor: boolean;
};

export const POLAROID_FRAME_LAYOUTS = {
  halloween: {
    id: "halloween",
    templateSrc: HALLOWEEN_POLAROID_FRAME_SRC,
    photo: { left: "16.2%", top: "15.2%", width: "67.8%", height: "50.7%" },
    caption: { left: "19%", right: "19%", top: "70.6%", bottom: "19%" },
    photoRadius: "4%",
    flowers: true,
    halloweenDecor: true,
  },
  felt: {
    id: "felt",
    templateSrc: FELT_POLAROID_FRAME_SRC,
    // The photo rectangle matches the stitched opening; draw the original felt
    // flowers above it so the photo does not cover the corner decorations.
    templateOverlay: true,
    photo: { left: "8.4%", top: "10.2%", width: "83.2%", height: "64.0%" },
    photoPlaceholderTextColor: "#6D543E",
    caption: { left: "14%", right: "14%", top: "77.2%", bottom: "7.2%" },
    captionTextColor: "#49372A",
    photoRadius: "7%",
    flowers: false,
    halloweenDecor: false,
  },
  gouache: {
    id: "gouache",
    templateSrc: GOUACHE_POLAROID_FRAME_SRC,
    // The supplied card's black opening is transparent in this derived alpha
    // overlay, keeping its flowers opaque while the photo shows through.
    templateOverlay: true,
    templateObjectFit: "contain",
    photo: { left: "13.4%", top: "10.2%", width: "73.2%", height: "57.0%" },
    photoPlaceholderTextColor: "#6D543E",
    caption: { left: "26%", right: "26%", top: "68.2%", bottom: "23.8%" },
    captionFontSize: "2.5cqw",
    captionTextColor: "#49372A",
    photoRadius: "0.5%",
    flowers: false,
    halloweenDecor: false,
  },
  crayon: {
    id: "crayon",
    templateSrc: CRAYON_POLAROID_FRAME_SRC,
    // Fill the measured inner opening. The transparent artwork overlay keeps
    // the irregular crayon edge and doodles above the photo.
    templateOverlay: true,
    photo: { left: "9.5%", top: "8.8%", width: "81.0%", height: "57.7%" },
    caption: { left: "16%", right: "16%", top: "70.0%", bottom: "8.8%" },
    photoRadius: "0.5%",
    flowers: false,
    halloweenDecor: false,
  },
} as const satisfies Record<string, PolaroidFrameLayout>;

/** Art styles that carry their own decorative frame. */
const POLAROID_ART_STYLE_FRAMES = {
  "felt-doll": POLAROID_FRAME_LAYOUTS.felt,
  "gouache-story": POLAROID_FRAME_LAYOUTS.gouache,
  "crayon-diary": POLAROID_FRAME_LAYOUTS.crayon,
} as const;

/**
 * Registered themes that were saved on the original seasonal template. They are
 * listed explicitly so every Polaroid already in the gallery keeps the frame it
 * was created with.
 */
export const SEASONAL_POLAROID_FRAME_THEME_IDS = [
  "halloween",
  "paper-collage",
  "starlight-oil",
  "miniature-world",
  "christmas-little-ghost",
  "christmas-santa-workshop",
  "christmas-first-snow-post",
  "christmas-snow-globe",
] as const;

/** True when the id names a theme this module can frame deliberately. */
export function isPolaroidFrameThemeKnown(themeId?: string | null): boolean {
  const id = typeof themeId === "string" ? themeId.trim() : "";
  if (!id) return false;
  return id in POLAROID_ART_STYLE_FRAMES
    || (SEASONAL_POLAROID_FRAME_THEME_IDS as readonly string[]).includes(id);
}

/**
 * Chooses which theme id decides a Polaroid's frame.
 *
 * Saved result metadata always wins. The questionnaire draft is only a
 * fallback for a Polaroid still being made: on a resumed session the draft is
 * empty, and letting it decide is what made a saved art-style Polaroid render
 * with the seasonal frame on the result page while the gallery, reading the
 * saved row, showed the right one. Returns null when neither is available, so
 * callers can tell "unknown" apart from a real choice.
 */
export function resolvePolaroidFrameThemeId(
  savedThemeId?: string | null,
  draftThemeId?: string | null,
): string | null {
  const saved = typeof savedThemeId === "string" ? savedThemeId.trim() : "";
  if (saved) return saved;
  const draft = typeof draftThemeId === "string" ? draftThemeId.trim() : "";
  return draft || null;
}

export function polaroidFrameLayout(themeId?: string | null): PolaroidFrameLayout {
  const id = typeof themeId === "string" ? themeId.trim() : "";
  const artStyle = POLAROID_ART_STYLE_FRAMES[id as keyof typeof POLAROID_ART_STYLE_FRAMES];
  if (artStyle) return artStyle;
  // Every other registered theme keeps the original seasonal template it was
  // saved with. Absent or unrecognised metadata also lands here because there
  // is no neutral frame to fall back to, so callers must pass the saved
  // themeId rather than rely on this branch.
  return POLAROID_FRAME_LAYOUTS.halloween;
}
