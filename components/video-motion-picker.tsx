"use client";

import { useLocale } from "@/components/locale-provider";
import type { VideoMotion } from "@/lib/survey";

type VideoMotionPickerProps = {
  petDisplayName: string;
  value: VideoMotion | "";
  onChange: (motion: VideoMotion) => void;
};

const MOTIONS: VideoMotion[] = ["breathing", "ears", "head_tilt", "tail"];

export function VideoMotionPicker({ petDisplayName, value, onChange }: VideoMotionPickerProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const prompt = t("survey.video.prompt").replace(/○○/g, petDisplayName.trim());

  return (
    <section
      className={`mx-auto mt-8 max-w-xl rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(12,10,8,0.55)] px-5 py-6 sm:px-7 ${bodyFont}`}
    >
      <p className="font-display-en text-[10px] uppercase tracking-[0.28em] text-[#D4AF37]/90">
        {t("survey.video.kicker")}
      </p>
      <p className="mt-3 text-sm font-extralight leading-relaxed text-[#EDE4D3] sm:text-[15px]">
        {prompt}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {MOTIONS.map((motion) => (
          <button
            key={motion}
            type="button"
            onClick={() => onChange(motion)}
            className={`min-h-[40px] rounded-xl border px-3 py-2 text-sm font-light transition ${
              value === motion
                ? "border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.14)] text-[#F5E6B8]"
                : "border-[rgba(212,175,55,0.28)] bg-transparent text-[#EDE4D3]/88 hover:border-[rgba(212,175,55,0.45)] hover:bg-[rgba(212,175,55,0.06)]"
            }`}
          >
            {t(`survey.video.motions.${motion}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
