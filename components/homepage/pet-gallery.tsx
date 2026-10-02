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
    ["/images/box.jpg", "firstHome"],
    ["/images/car.jpg", "quietRest"],
    ["/images/beach.jpg", "littleJourney"],
    ["/images/old.jpg", "sunsetMemory"],
  ] as const;
  const alternatePets = [
    ["/images/box.jpg", "firstHome"],
    ["/images/car.jpg", "quietRest"],
    ["/images/beach.jpg", "littleJourney"],
    ["/images/old.jpg", "sunsetMemory"],
  ] as const;
  const cardDetails = lang === "ko"
    ? [
        { year: "2018", title: "작은 시작", description: "나무 바닥에서 나를 올려다보던 고야.", story: "그 작은 얼굴이 나를 올려다보던 순간.\n지금 생각하면 너무나 큰 의미가 된 평범한 하루.", label: "THE EARLY DAYS" },
        { year: "2019", title: "집에서 보낸 평범한 하루", description: "빨간 하네스를 하고 침대 위에 있던 어린 고야.", story: "특별한 날도, 완벽한 포즈도 아니었어요.\n그저 집에서 나와 또 하루를 함께 보냈어요.", label: "AT HOME" },
        { year: "2021", title: "바다 곁에서", description: "빨간 리드줄을 하고 바닷가에 서 있던 고야.", story: "너와 바다, 그리고 함께한 짧은 시간.\n남겨두길 잘했다고 생각하는 순간.", label: "BY THE SEA" },
        { year: "2024", title: "여전히 곁에", description: "실내에서 카메라를 올려다보던 고야.", story: "시간은 흘렀지만, 익숙한 그 눈빛은 여전해요.\n그리고 우리에게는 오늘이 있어요.", label: "STILL TOGETHER" },
      ]
    : [
        { year: "2018", title: "A Little Beginning", description: "Puppy Goya looking up from the wooden floor.", story: "That little face, looking up at me.\nAn ordinary moment that means so much now.", label: "THE EARLY DAYS" },
        { year: "2019", title: "An Ordinary Day at Home", description: "Young Goya on the bed, wearing a red harness.", story: "No special occasion. No perfect pose.\nJust you, at home, sharing another day with me.", label: "AT HOME" },
        { year: "2021", title: "By the Sea", description: "Goya standing by the sea with a red leash.", story: "You, the sea, and a little time together.\nA moment I’m glad I kept.", label: "BY THE SEA" },
        { year: "2024", title: "Still By My Side", description: "Goya sitting indoors, looking up at the camera.", story: "The years have passed.\nThat familiar look is still yours.\nAnd we still have today.", label: "STILL TOGETHER" },
      ];

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
              className={`${display} ${styles.mobileHeadingOnLight} text-3xl font-light leading-tight sm:text-5xl`}
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

        <div className={`mx-auto mt-10 grid w-4/5 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 md:gap-4 ${isVisible ? styles.galleryPlaying : ""}`}>
          {pets.map((pet, index) => (
            <Reveal
              key={pet}
              delay={index * 40}
              className="group relative aspect-[4/6] min-w-0 overflow-hidden rounded-lg bg-[#f8f2e7] shadow-[0_10px_24px_rgba(67,48,29,0.12)] sm:rounded-xl md:rounded-2xl"
            >
              <div
                className={`${styles.galleryCardFace} ${styles.galleryOriginalFace} flex h-full flex-col`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={primaryImages[index][0]}
                    alt={t(`homepage.accessibility.gallery${pet[0].toUpperCase()}${pet.slice(1)}Alt`)}
                    fill
                    sizes="20vw"
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col space-y-1 px-2 pb-2 pt-2 text-left sm:space-y-1.5 sm:px-3 sm:pb-3 sm:pt-3">
                  <p className="text-[0.55rem] font-medium tracking-[0.12em] text-[#c8a24a] sm:text-xs">{cardDetails[index].year}</p>
                  <h3 className={`${display} text-[0.65rem] font-medium leading-tight text-[#2b2119] sm:text-sm`}>{cardDetails[index].title}</h3>
                  <p className={`${display} text-[0.48rem] italic leading-snug text-[#6d6258] sm:text-[0.62rem]`}>{cardDetails[index].description}</p>
                  <p className={`${display} whitespace-pre-line text-[0.5rem] leading-snug text-[#6d6258] sm:text-[0.68rem]`}>{cardDetails[index].story}</p>
                  <p className="mt-auto pt-1 text-[0.45rem] font-medium tracking-[0.12em] text-[#c8a24a] sm:pt-1.5 sm:text-[0.58rem]">{cardDetails[index].label}</p>
                </div>
              </div>
              <div
                className={`${styles.galleryCardFace} ${styles.galleryAlternateFace} flex h-full flex-col`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={alternatePets[index][0]}
                    alt={t(`homepage.gallery.${alternatePets[index][1]}`)}
                    fill
                    sizes="20vw"
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col space-y-1 px-2 pb-2 pt-2 text-left sm:space-y-1.5 sm:px-3 sm:pb-3 sm:pt-3">
                  <p className="text-[0.55rem] font-medium tracking-[0.12em] text-[#c8a24a] sm:text-xs">{cardDetails[index].year}</p>
                  <h3 className={`${display} text-[0.65rem] font-medium leading-tight text-[#2b2119] sm:text-sm`}>{cardDetails[index].title}</h3>
                  <p className={`${display} text-[0.48rem] italic leading-snug text-[#6d6258] sm:text-[0.62rem]`}>{cardDetails[index].description}</p>
                  <p className={`${display} whitespace-pre-line text-[0.5rem] leading-snug text-[#6d6258] sm:text-[0.68rem]`}>{cardDetails[index].story}</p>
                  <p className="mt-auto pt-1 text-[0.45rem] font-medium tracking-[0.12em] text-[#c8a24a] sm:pt-1.5 sm:text-[0.58rem]">{cardDetails[index].label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
