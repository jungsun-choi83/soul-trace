import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function SceneSvg({ children, ...props }: IconProps) {
  return <svg viewBox="0 0 96 80" fill="none" aria-hidden="true" className="h-full w-full" {...props}>{children}</svg>;
}

function Sparkles({ color = "#F8D77A" }: { color?: string }) {
  return <g fill={color}><path d="m77 10 1.7 4.1 4.3 1.7-4.3 1.7-1.7 4.1-1.7-4.1-4.3-1.7 4.3-1.7L77 10Z"/><circle cx="85" cy="28" r="1.5"/><circle cx="68" cy="8" r="1" opacity=".7"/></g>;
}

function House({ memorial = false }: { memorial?: boolean }) {
  const id = memorial ? "m-house" : "l-house";
  return <SceneSvg><defs><linearGradient id={id} x1="25" y1="21" x2="70" y2="69"><stop stopColor={memorial ? "#FFF0D2" : "#FFF1B9"}/><stop offset="1" stopColor={memorial ? "#C89B6B" : "#D89431"}/></linearGradient></defs><path d="m18 43 30-25 30 25" stroke={memorial ? "#DBB66F" : "#F8D66E"} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/><path d="M27 39v29h42V39L48 22 27 39Z" fill={`url(#${id})`}/><rect x="42" y="49" width="12" height="19" rx="2" fill="#8E6038"/><rect x="31" y="44" width="8" height="9" rx="2" fill="#FFF7C8"/><rect x="57" y="44" width="8" height="9" rx="2" fill="#FFF7C8"/><path d="M17 64c7-1 10-6 11-12-8 1-12 5-11 12Zm61 1c-6-2-8-7-8-12 7 2 10 6 8 12Z" fill={memorial ? "#8EAA83" : "#65BC80"}/><Sparkles color={memorial ? "#E5C58A" : "#FFF0A6"}/></SceneSvg>;
}

function Waves({ memorial = false }: { memorial?: boolean }) {
  const id = memorial ? "m-sea" : "l-sea";
  return <SceneSvg><defs><linearGradient id={id} x1="15" y1="31" x2="80" y2="66"><stop stopColor={memorial ? "#81D5D5" : "#55E6EE"}/><stop offset="1" stopColor={memorial ? "#538FCB" : "#168EE7"}/></linearGradient></defs>{memorial&&<circle cx="65" cy="27" r="10" fill="#F4B487" opacity=".9"/>}<path d="M14 48c10-12 20-12 30 0s20 12 38-2v15c-17 12-30 12-42 1S20 54 14 62V48Z" fill={`url(#${id})`}/><path d="M17 44c9-8 17-8 26 0 10 9 19 10 35 0" stroke="#E6FCFA" strokeWidth="4" strokeLinecap="round"/><path d="M23 57c8-5 14-4 21 2" stroke={memorial ? "#B3ECE7" : "#8AF7F0"} strokeWidth="3" strokeLinecap="round"/><Sparkles color={memorial ? "#F1C893" : "#F8D77A"}/></SceneSvg>;
}

function Paws({ memorial = false }: { memorial?: boolean }) {
  const id = memorial ? "m-paw" : "l-paw";
  return <SceneSvg><defs><linearGradient id={id} x1="20" y1="20" x2="68" y2="67"><stop stopColor={memorial ? "#E3AD9F" : "#FFBC66"}/><stop offset="1" stopColor={memorial ? "#C58B70" : "#EF6257"}/></linearGradient></defs><g fill={`url(#${id})`}><ellipse cx="38" cy="49" rx="12" ry="10" transform="rotate(-18 38 49)"/><circle cx="23" cy="35" r="5"/><circle cx="33" cy="28" r="5"/><circle cx="44" cy="30" r="5"/><circle cx="51" cy="39" r="5"/></g><path d="M61 63c8-10 14-18 19-31" stroke="#E6C675" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 7"/><path d="M67 48c7 0 11-4 13-10-7-1-12 3-13 10Z" fill={memorial ? "#91A988" : "#69C88B"}/><Sparkles/></SceneSvg>;
}

function Flowers({ memorial = false }: { memorial?: boolean }) {
  const id = memorial ? "m-flower" : "l-flower";
  return <SceneSvg><defs><linearGradient id={id} x1="25" y1="20" x2="70" y2="67"><stop stopColor={memorial ? "#E7A9B7" : "#FF83B7"}/><stop offset=".55" stopColor={memorial ? "#D7A4A6" : "#FFB17B"}/><stop offset="1" stopColor="#FFD664"/></linearGradient></defs><path d="M25 68c8-15 14-25 25-39M48 68c4-17 9-27 19-37M48 53c-9-2-14-7-16-14M58 48c9-2 14-7 16-14" stroke={memorial ? "#91AE87" : "#64C788"} strokeWidth="4" strokeLinecap="round"/><g fill={`url(#${id})`}><circle cx="48" cy="25" r="8"/><circle cx="68" cy="29" r="7"/><circle cx="27" cy="36" r="7"/></g><g fill="#FFF1A8"><circle cx="48" cy="25" r="3"/><circle cx="68" cy="29" r="2.5"/><circle cx="27" cy="36" r="2.5"/></g><Sparkles/></SceneSvg>;
}

function Sunset({ memorial = false }: { memorial?: boolean }) {
  const id = memorial ? "m-sunset" : "l-sunset";
  return <SceneSvg><defs><radialGradient id={id}><stop stopColor="#FFF2A5"/><stop offset=".55" stopColor={memorial ? "#EFA16E" : "#FFB33D"}/><stop offset="1" stopColor={memorial ? "#C96F72" : "#F26339"}/></radialGradient></defs><circle cx="48" cy="35" r="19" fill={`url(#${id})`} className="drop-shadow-[0_0_8px_rgba(246,171,67,.45)]"/><path d="M17 55h62M23 63h50" stroke={memorial ? "#B887A2" : "#E66D42"} strokeWidth="4" strokeLinecap="round"/><Sparkles color={memorial ? "#E9C8A0" : "#FFE09A"}/></SceneSvg>;
}

function CustomSparkles({ memorial = false }: { memorial?: boolean }) {
  return <SceneSvg><circle cx="48" cy="40" r="25" fill={memorial ? "#A88ABC" : "#D5A34A"} opacity=".1"/><path d="m48 17 4.7 11.3L64 33l-11.3 4.7L48 49l-4.7-11.3L32 33l11.3-4.7L48 17Z" fill="#F5CD68"/><path d="m27 43 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5 2.5-6Z" fill={memorial ? "#D6A8C5" : "#EF8FB7"}/><path d="m70 39 2.3 5.3 5.3 2.3-5.3 2.3-2.3 5.3-2.3-5.3-5.3-2.3 5.3-2.3L70 39Z" fill={memorial ? "#B6A6E5" : "#72DDE4"}/><circle cx="69" cy="22" r="3" fill="#B3A0E8"/></SceneSvg>;
}

export const LivingByTheSeaIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Waves/></span>;
export const LivingAtHomeIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><House/></span>;
export const LivingOnAWalkIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Paws/></span>;
export const LivingFlowerFieldIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Flowers/></span>;
export function LivingPlaytimeIcon(props: IconProps) { return <SceneSvg {...props}><defs><radialGradient id="ball"><stop stopColor="#FFE891"/><stop offset=".55" stopColor="#FFB13D"/><stop offset="1" stopColor="#EF6938"/></radialGradient></defs><circle cx="47" cy="42" r="24" fill="#FF9A3D" opacity=".12"/><circle cx="47" cy="42" r="18" fill="url(#ball)"/><path d="M32 38c9 1 16-4 21-12M42 58c1-9 7-15 18-17" stroke="#FFF3B1" strokeWidth="3"/><Sparkles/></SceneSvg>; }
export function LivingCozyBedtimeIcon(props: IconProps) { return <SceneSvg {...props}><defs><linearGradient id="moon" x1="28" y1="15" x2="63" y2="60"><stop stopColor="#D6C6FF"/><stop offset="1" stopColor="#668DE8"/></linearGradient></defs><path d="M55 15c-18 5-20 31-3 40 9 5 19 1 25-5-19 2-27-20-22-35Z" fill="url(#moon)"/><path d="M16 61c2-9 15-12 21-5 5-7 18-4 19 5H16Z" fill="#B9D9F4"/><Sparkles color="#F4E8A5"/></SceneSvg>; }
export const LivingGoldenSunsetIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Sunset/></span>;
export const LivingCustomSceneIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><CustomSparkles/></span>;

export function MemorialFavoritePlaceIcon(props: IconProps) { return <SceneSvg {...props}><defs><linearGradient id="pin" x1="30" y1="14" x2="65" y2="67"><stop stopColor="#F3B0AC"/><stop offset="1" stopColor="#C78876"/></linearGradient></defs><path d="M48 70S25 48 25 32a23 23 0 1 1 46 0C71 48 48 70 48 70Z" fill="url(#pin)"/><path d="M48 43c-11-7-12-16-6-18 3-1 5 1 6 3 2-3 4-4 7-3 6 3 4 12-7 18Z" fill="#FFE8C0"/><path d="M19 62c7-1 10-5 11-11-7 1-11 4-11 11Z" fill="#91AD86"/><Sparkles/></SceneSvg>; }
export const MemorialAtHomeIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><House memorial/></span>;
export const MemorialByTheSeaIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Waves memorial/></span>;
export const MemorialOurWalkIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Paws memorial/></span>;
export const MemorialPeacefulGardenIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Flowers memorial/></span>;
export const MemorialGoldenEveningIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><Sunset memorial/></span>;
export function MemorialTogetherAgainIcon(props: IconProps) { return <SceneSvg {...props}><defs><radialGradient id="heart"><stop stopColor="#FFE1CF"/><stop offset=".55" stopColor="#EBA9AD"/><stop offset="1" stopColor="#A78CC7"/></radialGradient></defs><circle cx="48" cy="41" r="29" fill="#C5A4D6" opacity=".1"/><path d="M48 64C25 50 20 35 29 27c7-7 15-3 19 4 4-7 12-11 19-4 9 8 4 23-19 37Z" fill="url(#heart)" className="drop-shadow-[0_0_9px_rgba(232,170,178,.5)]"/><Sparkles color="#EACB91"/></SceneSvg>; }
export const MemorialCustomMemoryIcon = (props: IconProps) => <span className={`block ${props.className ?? ""}`}><CustomSparkles memorial/></span>;

export const LIVING_SCENE_ICONS: Record<string, ComponentType<IconProps>> = {
  "by-the-sea": LivingByTheSeaIcon, "at-home": LivingAtHomeIcon, "on-a-walk": LivingOnAWalkIcon,
  "flower-field": LivingFlowerFieldIcon, playtime: LivingPlaytimeIcon, "cozy-bedtime": LivingCozyBedtimeIcon,
  "golden-sunset": LivingGoldenSunsetIcon, "custom-scene": LivingCustomSceneIcon,
};

export const MEMORIAL_SCENE_ICONS: Record<string, ComponentType<IconProps>> = {
  "favorite-place": MemorialFavoritePlaceIcon, "at-home": MemorialAtHomeIcon, "by-the-sea": MemorialByTheSeaIcon,
  "our-walk": MemorialOurWalkIcon, "peaceful-garden": MemorialPeacefulGardenIcon, "golden-evening": MemorialGoldenEveningIcon,
  "together-again": MemorialTogetherAgainIcon, "custom-memory": MemorialCustomMemoryIcon,
};
