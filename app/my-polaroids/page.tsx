import type { Metadata } from "next";

import { MyPolaroidsPage } from "@/components/my-polaroids-page";

export const metadata: Metadata = {
  title: "My Polaroids",
  robots: { index: false, follow: false },
};

export default function MyPolaroidsRoute() {
  return <MyPolaroidsPage />;
}
