import { WelcomeExperience } from "@/components/welcome-experience";
import { authEntryPath } from "@/lib/auth-redirect";
import { hrefWithSearchParams, type ServerSearchParams } from "@/lib/search-params";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome | Soul Trace",
  description: "Begin your Soul Trace journey.",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const choiceHref = hrefWithSearchParams("/choose", await searchParams);

  return (
    <WelcomeExperience
      choiceHref={authEntryPath(choiceHref)}
    />
  );
}
