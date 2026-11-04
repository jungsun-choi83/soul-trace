export const HALLOWEEN_POLAROID_FRAME_SRC = "/images/soul_trace_seasonal_polaroid_blank_caption_template.png";
export const FELT_POLAROID_FRAME_SRC = "/images/polaroid/frame-felt.jpg";
export const GOUACHE_POLAROID_FRAME_SRC = "/images/polaroid/frame-gouache.jpg";
export const CRAYON_POLAROID_FRAME_SRC = "/images/polaroid/frame-crayon.jpg";

export type PolaroidFrameLayout = {
  id: "halloween" | "felt" | "gouache" | "crayon";
  templateSrc: string;
  photo: { left: string; top: string; width: string; height: string };
  caption: { left: string; right: string; top: string; bottom: string };
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
    photo: { left: "8.4%", top: "8.0%", width: "83.2%", height: "66.6%" },
    caption: { left: "14%", right: "14%", top: "77.2%", bottom: "7.2%" },
    photoRadius: "7%",
    flowers: false,
    halloweenDecor: false,
  },
  gouache: {
    id: "gouache",
    templateSrc: GOUACHE_POLAROID_FRAME_SRC,
    photo: { left: "11.0%", top: "10.6%", width: "78.0%", height: "63.8%" },
    caption: { left: "16%", right: "16%", top: "76.8%", bottom: "8.6%" },
    photoRadius: "1.6%",
    flowers: false,
    halloweenDecor: false,
  },
  crayon: {
    id: "crayon",
    templateSrc: CRAYON_POLAROID_FRAME_SRC,
    photo: { left: "10.2%", top: "9.4%", width: "79.6%", height: "63.4%" },
    caption: { left: "16%", right: "16%", top: "75.8%", bottom: "9.4%" },
    photoRadius: "6%",
    flowers: false,
    halloweenDecor: false,
  },
} as const satisfies Record<string, PolaroidFrameLayout>;

export function polaroidFrameLayout(themeId?: string | null): PolaroidFrameLayout {
  if (themeId === "felt-doll") return POLAROID_FRAME_LAYOUTS.felt;
  if (themeId === "gouache-story") return POLAROID_FRAME_LAYOUTS.gouache;
  if (themeId === "crayon-diary") return POLAROID_FRAME_LAYOUTS.crayon;
  return POLAROID_FRAME_LAYOUTS.halloween;
}
