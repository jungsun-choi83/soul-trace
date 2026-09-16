"use client";
import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { Reveal } from "./reveal";

export function PetGallery() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const pets = ["dog", "cat", "rabbit", "bird", "hamster"];
  return <section className="bg-[#f8f2e7] py-20 text-[#1a1512] md:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="mx-auto max-w-2xl text-center"><Reveal><p className="mb-4 text-xs uppercase tracking-[0.28em] text-[#c8a24a]">{t("homepage.gallery.label")}</p></Reveal><Reveal delay={80}><h2 className={`${display} text-3xl font-light leading-tight sm:text-5xl`}>{t("homepage.gallery.title")}</h2></Reveal><Reveal delay={160}><p className={`${display} mx-auto mt-5 max-w-lg leading-relaxed text-[#1a1512]/65`}>{t("homepage.gallery.body")}</p></Reveal></div><div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">{pets.map((pet, i) => <Reveal key={pet} delay={i * 90} className={`group relative min-w-0 aspect-square overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2 md:col-span-1 md:row-span-1" : ""}`}><Image src={`/homepage/pets/gallery-${pet}.png`} alt={t(`homepage.accessibility.gallery${pet[0].toUpperCase()}${pet.slice(1)}Alt`)} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover object-center transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-[#0b0a09]/70 via-transparent to-transparent opacity-70 group-hover:opacity-90" /><span className={`${display} absolute bottom-4 left-4 text-lg text-[#f8f2e7]`}>{t(`homepage.gallery.${pet}`)}</span></Reveal>)}</div></div></section>;
}
