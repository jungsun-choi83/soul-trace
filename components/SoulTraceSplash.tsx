"use client";

import { EternalBeamLogo } from "@/components/storybook/eternal-beam-logo";
import { useLocale } from "@/components/locale-provider";
import { SPLASH_ART_SRC } from "@/lib/splash-entry";
import Image from "next/image";
import styles from "./SoulTraceSplash.module.css";

/** Standalone visual layer: no nav, no forms, no auth, no CTA.
 * Parent is responsible for deciding whether/when to show and hide this layer.
 * Do not change /living, /memorial, /polaroid, /choose or letter generation.
 */
export function SoulTraceSplash({
  onDismiss,
  fading = false,
}: {
  onDismiss?: () => void;
  fading?: boolean;
}) {
  const { t } = useLocale();

  return (
    <div
      className={`${styles.screen}${fading ? ` ${styles.leaving}` : ""}`}
      role="status"
      aria-label={t("splash.label")}
      aria-hidden={fading}
      onClick={fading ? undefined : onDismiss}
    >
      <Image
        src={SPLASH_ART_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className={styles.scene}
      />
      <div className={styles.paperFade} aria-hidden="true" />
      <div className={styles.identity}>
        <EternalBeamLogo className={styles.mark} />
        <div className={styles.wordmark}>SoulTrace</div>
        <p className={styles.tagline}>
          {t("splash.tagline").split("\n").map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        <p className={styles.loading}>{t("splash.loading")}</p>
      </div>
      {onDismiss ? (
        <button className={styles.srOnly} onClick={onDismiss} type="button">
          {t("splash.skip")}
        </button>
      ) : null}
    </div>
  );
}
