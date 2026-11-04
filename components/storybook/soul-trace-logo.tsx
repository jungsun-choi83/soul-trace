import Image from "next/image";

export function SoulTraceLogo({ tone = "paper", className = "h-3.5 w-auto sm:h-4" }: { tone?: "paper" | "night"; className?: string }) {
  return (
    <Image
      src={tone === "night" ? "/images/brand/soul-trace-logo-gold.png" : "/images/brand/soul-trace-logo-ink.png"}
      alt="SOUL TRACE"
      width={719}
      height={80}
      priority
      className={`select-none ${className}`}
    />
  );
}
