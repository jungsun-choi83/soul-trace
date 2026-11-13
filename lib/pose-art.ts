/** Demo gouache poses. Never replace a photo the owner uploaded. */
export const POSE_ART = {
  shibaSpring: "/images/poses/shiba-spring.jpg",
  shibaHome: "/images/poses/shiba-home.jpg",
  shibaAutumn: "/images/poses/shiba-autumn.jpg",
  corgiSpring: "/images/poses/corgi-spring.jpg",
  corgiHome: "/images/poses/corgi-home.jpg",
  corgiAutumn: "/images/poses/corgi-autumn.jpg",
} as const;

export const POSE_IMAGE_CLASS = "w-full object-contain object-center";

const POSE_PIXELS = { width: 941, height: 1672 };

export function poseSize(_src: string) {
  return POSE_PIXELS;
}
