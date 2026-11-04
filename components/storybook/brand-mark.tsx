import Image from "next/image";

export function BrandMark({ className = "h-10 w-auto" }: { className?: string }) {
  const sized = className.replace(/\bw-(?:\[[^\]]+\]|\S+)/g, "").replace(/\s+/g, " ").trim();
  return (
    <Image
      src="/images/brand/eternal-beam-mark.png"
      alt=""
      width={465}
      height={316}
      className={`w-auto object-contain ${sized || "h-10"}`}
    />
  );
}
