import { notFound } from "next/navigation";

import { StorybookPreview } from "./preview";

export const dynamic = "force-dynamic";

export default async function StorybookPreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen } = await searchParams;
  return <StorybookPreview screen={screen ?? "home"} />;
}
