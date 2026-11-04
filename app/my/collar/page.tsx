import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollarStudioRoute } from "@/components/collar-studio";
import { collarStudioPet } from "@/lib/collar-route-pet";
import { isPetFirstArchiveEnabled } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "스마트 목걸이",
  description: "스마트 목걸이 연결 상태와 화면을 미리 봅니다. 실제 블루투스 전송은 아직 연결되지 않았습니다.",
  robots: noIndexRobots,
};

export default async function CollarHubPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const pet = await collarStudioPet(await searchParams);
  return <CollarStudioRoute step="hub" pet={pet} />;
}
