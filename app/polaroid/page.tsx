import { PolaroidEntry } from "@/components/polaroid-entry";
import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seasonal Polaroid | Soul Trace",
  description: "Create a seasonal Polaroid keepsake from a moment with your pet.",
  alternates: { canonical: "/polaroid" },
};

export default function PolaroidPage() {
  return <PolaroidEntry generationEnabled={isSeasonalPolaroidEnabled()} />;
}
