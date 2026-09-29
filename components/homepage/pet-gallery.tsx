"use client";

import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function PetGallery() {
  const { lang, t } = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const pets = ["cat", "rabbit", "bird", "hamster"];
  const primaryImages = [
    ["/homepage/pets/im1.png", "firstHome"],
    ["/homepage/pets/im2.png", "quietRest"],
    ["/homepage/pets/im3.png", "littleJourney"],
    ["/homepage/pets/im4.png", "sunsetMemory"],
  ] as const;
  const alternatePets = [
    ["/homepage/pets/im5.png", "beachMemory"],
    ["/homepage/pets/im6.png", "gentleTouch"],
    ["/homepage/pets/im7.png", "alwaysTogether"],
    ["/homepage/pets/im8.png", "todaysMoment"],
  ] as const;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-[#f8f2e7] py-14 text-[#1a1512] md:py-20"
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="mb-4 text-xs uppercase tracking-[0.28em] text-[#c8a24a]">
              {t("homepage.gallery.label")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className={`${display} text-3xl font-light leading-tight sm:text-5xl`}
            >
              {t("homepage.gallery.title")}
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p
              className={`${display} mx-auto mt-5 max-w-lg leading-relaxed text-[#1a1512]/65`}
            >
              {t("homepage.gallery.body")}
            </p>
          </Reveal>
        </div>

        <div className={`mx-auto mt-10 grid w-4/5 grid-cols-4 gap-1.5 sm:gap-3 md:gap-4 ${isVisible ? styles.galleryPlaying : ""}`}>
          {pets.map((pet, index) => (
            <Reveal
              key={pet}
              delay={index * 40}
              className="group relative aspect-square min-w-0 overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl"
            >
              <div
                className={`${styles.galleryCardFace} ${styles.galleryOriginalFace}`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <Image
                  src={primaryImages[index][0]}
                  alt={t(
                    `homepage.accessibility.gallery${pet[0].toUpperCase()}${pet.slice(1)}Alt`,
                  )}
                  fill
                  sizes="20vw"
                  className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a09]/70 via-transparent to-transparent opacity-70 group-hover:opacity-90" />
                <span
                  className={`${display} absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] text-[clamp(0.55rem,2.2vw,1.125rem)] leading-tight text-[#f8f2e7] sm:bottom-2 sm:left-2 md:bottom-4 md:left-4`}
                >
                  {t(`homepage.gallery.${primaryImages[index][1]}`)}
                </span>
              </div>
              <div
                className={`${styles.galleryCardFace} ${styles.galleryAlternateFace}`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                  <Image
                    src={alternatePets[index][0]}
                    alt={t(`homepage.gallery.${alternatePets[index][1]}`)}
                  fill
                  sizes="20vw"
                  className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a09]/70 via-transparent to-transparent opacity-70 group-hover:opacity-90" />
                <span
                  className={`${display} absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] text-[clamp(0.55rem,2.2vw,1.125rem)] leading-tight text-[#f8f2e7] sm:bottom-2 sm:left-2 md:bottom-4 md:left-4`}
                  >
                  {t(`homepage.gallery.${alternatePets[index][1]}`)}
                  </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
