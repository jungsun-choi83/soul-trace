import { hrefWithSearchParams, type ServerSearchParams } from "@/lib/search-params";
import { redirect } from "next/navigation";

export default async function WelcomeAliasPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  redirect(hrefWithSearchParams("/", await searchParams));
}
