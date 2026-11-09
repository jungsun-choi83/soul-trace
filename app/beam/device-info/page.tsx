import { FlowNote } from "@/components/flow-note";
import { POSE_ART } from "@/lib/pose-art";
import type { LifeStatus } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Eternal Beam 기기 안내" };

export default async function BeamDeviceInfoPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params.branch;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const lifeStatus: LifeStatus = value === "memorial" ? "memorial" : value === "living" ? "living" : "unspecified";
  return (
    <FlowNote
      art={POSE_ART.shibaHome}
      lifeStatus={lifeStatus}
      tab="memories"
      title="Eternal Beam 기기 안내"
      body="Eternal Beam은 SoulTrace와 따로 있는 기기입니다. 이 안내는 전송 완료가 아니며, 기기가 받기 전에는 장면에 적용되지 않습니다."
      links={[
        { href: "/beam/scenes", label: "장면 보관함" },
        { href: "/beam/scenes/preview", label: "장면 미리보기" },
      ]}
    />
  );
}
