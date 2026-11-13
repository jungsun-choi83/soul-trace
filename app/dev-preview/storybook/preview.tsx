"use client";

import { AccountSettings } from "@/components/account-settings";
import { CollarProvider } from "@/components/collar/collar-provider";
import { CollarStudio } from "@/components/collar-studio";
import { CustomerDashboard } from "@/components/customer-dashboard";
import { PetFirstMemory } from "@/components/pet-first-memory";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { PetRoster } from "@/components/pet-roster";

const TODAY = "2026-10-31";
const PET_ID = "00000000-0000-4000-8000-000000000001";
const img = (name: string) =>
  ({
    home: "/images/design/sunroom.jpg",
    timeline: "/images/design/spring-walk.jpg",
    letter: "/images/design/letter-scene.jpg",
    memorial: "/images/design/memorial-night.jpg",
    monthly: "/images/design/monthly-meadow.jpg",
  }[name] ?? `/images/design/${name}.jpg`);

const timeline = [
  entry("e1", "photo", "산책길 낙엽 밟기", "오늘은 낙엽 소리가 좋은지 한참을 멈춰 섰다.", "2026-10-29", [img("home")]),
  entry("e2", "text", null, "창가에서 낮잠. 햇살이 꼬리 끝에 머물렀다.", "2026-10-20", []),
  entry("e3", "photo", "고양이 친구와 나란히", null, null, [img("timeline"), img("monthly")]),
  entry("e4", "photo", "작년 오늘, 첫 단풍", "처음 본 단풍잎을 한참 냄새 맡았지.", "2025-10-31", [img("letter")]),
  entry("e5", "text", "처음 집에 온 날", "작은 상자 안에서 눈만 동그랗게 떴다.", "2025-06-14", []),
];

function entry(id: string, kind: "photo" | "text", title: string | null, story: string | null, happenedOn: string | null, urls: string[]) {
  return {
    entryId: id,
    kind,
    title,
    story,
    happenedOn,
    createdAt: `${happenedOn ?? "2026-10-15"}T09:00:00Z`,
    origin: "pet_first" as const,
    deletable: true,
    assets: urls.map((url, order) => ({ assetId: `${id}-${order}`, url, contentType: "image/jpeg", order })),
  };
}

let patched = false;
function patchFetch(mode: string) {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/my/pets/")) {
      if (mode === "error") return new Response("{}", { status: 500 });
      if (mode === "loading") return new Promise<Response>(() => {});
      return new Response(JSON.stringify({ timeline: mode === "empty" ? [] : timeline }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return original(input, init);
  };
}

const profile = {
  petId: PET_ID,
  petName: "고야",
  lifeStatus: "living" as const,
  species: "시바견",
  birthday: "2021-04-02",
  adoptedOn: "2021-06-14",
  traits: "간식 봉지 소리에 제일 먼저 달려오는 아이",
  letterCount: 2,
};

export function StorybookPreview({ screen }: { screen: string }) {
  patchFetch(screen.replace(/^pet-/, ""));
  if (screen === "unavailable") return <PetFirstUnavailable />;
  if (screen === "collar") {
    return (
      <CollarProvider pet={{ petId: PET_ID, petName: "고야" }}>
        <CollarStudio step="hub" />
      </CollarProvider>
    );
  }
  if (screen === "collar-send") {
    return (
      <CollarProvider pet={{ petId: PET_ID, petName: "고야" }}>
        <CollarStudio step="send" />
      </CollarProvider>
    );
  }
  if (screen === "home-memorial") {
    return (
      <CustomerDashboard
        selectedPetId={PET_ID}
        initialPets={[{ petId: PET_ID, petName: "고야", lifeStatus: "memorial", species: "시바견", birthday: "2021-04-02", createdAt: "2026-01-01T00:00:00Z", entryDays: ["2026-10-29"], letterCount: 2, avatarUrl: null }]}
        recent={timeline.slice(0, 3).map((item) => ({ entryId: item.entryId, petId: PET_ID, petName: "고야", kind: item.kind, title: item.title, story: item.story, happenedOn: item.happenedOn, createdAt: item.createdAt, imageUrl: item.assets[0]?.url ?? null, favorite: false }))}
      />
    );
  }
  if (screen === "home-empty") return <CustomerDashboard initialPets={[]} recent={[]} />;
  if (screen === "roster" || screen === "pet") {
    return (
      <PetRoster
        pets={[
          { petId: PET_ID, petName: "고야", lifeStatus: "living", species: "시바견", birthday: "2021-04-02", createdAt: "2026-01-01T00:00:00Z", entryDays: ["2026-10-29", "2026-10-20", "2026-10-15"], letterCount: 2, avatarUrl: null },
          { petId: "00000000-0000-4000-8000-000000000002", petName: "나비", lifeStatus: "memorial", species: "고양이", birthday: null, createdAt: "2025-01-01T00:00:00Z", entryDays: [], letterCount: 1, avatarUrl: null },
        ]}
      />
    );
  }
  if (screen === "settings") return <AccountSettings email="preview@soultrace.pet" petId={PET_ID} />;
  if (screen === "home") {
    return (
      <CustomerDashboard
        selectedPetId={PET_ID}
        initialPets={[
          { petId: PET_ID, petName: "고야", lifeStatus: "living", species: "시바견", birthday: "2021-04-02", createdAt: "2026-01-01T00:00:00Z", entryDays: ["2026-10-29", "2026-10-20", "2026-10-15"], letterCount: 2, avatarUrl: null },
          { petId: "00000000-0000-4000-8000-000000000002", petName: "나비", lifeStatus: "memorial", species: "고양이", birthday: null, createdAt: "2025-01-01T00:00:00Z", entryDays: [], letterCount: 1, avatarUrl: null },
        ]}
        recent={timeline.slice(0, 4).map((item) => ({
          entryId: item.entryId,
          petId: PET_ID,
          petName: "고야",
          kind: item.kind,
          title: item.title,
          story: item.story,
          happenedOn: item.happenedOn,
          createdAt: item.createdAt,
          imageUrl: item.assets[0]?.url ?? null,
          favorite: false,
        }))}
      />
    );
  }
  if (screen === "memorial") return <PetFirstMemory profile={{ ...profile, petName: "나비", species: "고양이", lifeStatus: "memorial", traits: "햇살 자리를 제일 잘 알던 아이" }} today={TODAY} />;
  return <PetFirstMemory profile={profile} today={TODAY} />;
}
