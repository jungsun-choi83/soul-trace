import Image from "next/image";

export function EternalBeamLogo({ className = "h-auto w-36" }: { className?: string }) {
  return (
    <Image
      src="/images/brand/eternal-beam-mark.png"
      alt=""
      width={465}
      height={316}
      priority
      className={className}
    />
  );
}
