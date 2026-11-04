/** Clean gouache illustrations only. Never use screens_live phone screenshots. */
export const CLEAN_ART = {
  livingHero: "/images/soultrace-splash-background.png",
  memorialHero: "/images/soultrace-night-window.png",
  nightWindow: "/images/soultrace-night-window.png",
  running: "/images/art/golden-retriever.png",
  walk: "/images/art/corgi-autumn.png",
} as const;

export const CLEAN_ART_SIZE: Record<string, { width: number; height: number }> = {
  [CLEAN_ART.livingHero]: { width: 1080, height: 1920 },
  [CLEAN_ART.memorialHero]: { width: 1086, height: 1448 },
  [CLEAN_ART.running]: { width: 512, height: 1024 },
  [CLEAN_ART.walk]: { width: 887, height: 1774 },
  "/images/art/cat-window.png": { width: 512, height: 1024 },
};

export function cleanArtSize(src: string): { width: number; height: number } {
  return CLEAN_ART_SIZE[src] ?? { width: 1080, height: 1440 };
}

export const COMPOSITE_UI_ART = [
  "/images/design/sunroom.jpg",
  "/images/design/memorial-night.jpg",
  "/images/design/letter-scene.jpg",
  "/images/design/dog-portrait.jpg",
  "/images/design/monthly-meadow.jpg",
  "/images/design/memory-bloom.jpg",
  "/images/design/livingroom.jpg",
] as const;
