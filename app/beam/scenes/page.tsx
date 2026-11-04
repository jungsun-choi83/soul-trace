import { FlowNote } from "@/components/flow-note";
import type { LifeStatus } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Eternal Beam 장면 보관함" };

export default async function BeamScenesPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params.branch;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const lifeStatus: LifeStatus = value === "memorial" ? "memorial" : value === "living" ? "living" : "unspecified";
  const petRaw = params.pet;
  const pet = Array.isArray(petRaw) ? petRaw[0] : petRaw;
  const preview = pet ? `/beam/scenes/preview?pet=${encodeURIComponent(pet)}` : "/beam/scenes/preview";
  return (
    <FlowNote
      lifeStatus={lifeStatus}
      tab="memories"
      title="Eternal Beam 장면 보관함"
      body="추억으로 구성한 장면 미리보기를 모아 두는 자리입니다. 기기로 전송되었거나 재생이 준비된 상태는 아닙니다."
      links={[
        { href: preview, label: "장면 미리보기" },
        { href: "/beam/device-info", label: "기기 안내" },
      ]}
    />
  );
}
