"use client";

import { englishLetterOpeningFont } from "@/components/generated-letter-fonts";
import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { LuPawPrint } from "react-icons/lu";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

const cards = [
  {
    image: "/images/halloween/card-1-witch-shiba-clean.png",
    title: "card1Title",
    description: "card1Description",
    label: "card1Label",
    alt: "card1Alt",
  },
  {
    image: "/images/halloween/card-2-ghost-puppy-clean.png",
    title: "card2Title",
    description: "card2Description",
    label: "card2Label",
    alt: "card2Alt",
  },
  {
    image: "/images/halloween/card-3-adventure-clean.png",
    title: "card3Title",
    description: "card3Description",
    label: "card3Label",
    alt: "card3Alt",
  },
  {
    image: "/images/halloween/card-4-pumpkin-cat-clean.png",
    title: "card4Title",
    description: "card4Description",
    label: "card4Label",
    alt: "card4Alt",
  },
] as const;

export function PetGallery() {
  const { lang, t } = useLocale();
  const isKorean = lang === "ko";
  const display = isKorean ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const titleAfter = t("homepage.gallery.titleAfter").split("\n");

  return (
    <section className={styles.halloweenSection}>
      <div className={styles.halloweenAmbient} aria-hidden="true" />

      <Image
        src="/images/halloween/decor-left-clean.png"
        alt=""
        aria-hidden="true"
        width={550}
        height={744}
        className={`${styles.halloweenDecor} ${styles.halloweenDecorLeft}`}
      />
      <Image
        src="/images/halloween/decor-right-clean.png"
        alt=""
        aria-hidden="true"
        width={573}
        height={744}
        className={`${styles.halloweenDecor} ${styles.halloweenDecorRight}`}
      />

      <div className={styles.halloweenContent}>
        <div className={styles.halloweenIntro}>
          <Reveal className={styles.halloweenReveal}>
            <p className={styles.halloweenEyebrow}>
              {t("homepage.gallery.label")}
            </p>
          </Reveal>

          <Reveal delay={80} className={styles.halloweenReveal}>
            <h2 className={`${display} ${styles.halloweenHeading}`}>
              <span>
                {t("homepage.gallery.titleBefore")}
                <span className={`${isKorean ? "font-ko text-[0.9em] font-medium" : `${englishLetterOpeningFont.className} text-[1.12em]`} text-[#db6d24]`}>
                  {t("homepage.gallery.titleHighlight")}
                </span>
                {titleAfter[0]}
              </span>
              <br />
              <span>{titleAfter.slice(1).join("\n")}</span>
            </h2>
          </Reveal>

          <Reveal delay={120} className={styles.halloweenReveal}>
            <p className={`${display} ${styles.halloweenDescription}`}>
              {t("homepage.gallery.body")}
            </p>
          </Reveal>

          <div className={styles.halloweenPaw} aria-hidden="true">
            <LuPawPrint strokeWidth={1.5} />
          </div>
        </div>

        <div className={styles.halloweenGrid}>
          {cards.map((card, index) => (
            <Reveal key={card.image} delay={index * 60} className={styles.halloweenReveal}>
              <article className={styles.halloweenCard}>
                <div className={styles.halloweenPhoto}>
                  <Image
                    src={card.image}
                    alt={t(`homepage.gallery.${card.alt}`)}
                    fill
                    sizes="(max-width: 639px) 90vw, (max-width: 1023px) 44vw, 230px"
                    className={styles.halloweenPhotoImage}
                  />
                </div>
                <div className={styles.halloweenCardContent}>
                  <h3 className={`${display} ${styles.halloweenCardTitle}`}>
                    {t(`homepage.gallery.${card.title}`)}
                  </h3>
                  <p className={`${display} ${styles.halloweenCardDescription}`}>
                    {t(`homepage.gallery.${card.description}`)}
                  </p>
                  <p className={styles.halloweenCardLabel}>
                    {t(`homepage.gallery.${card.label}`)}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
