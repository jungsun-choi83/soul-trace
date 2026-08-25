/**
 * 히어로 이미지 **영구 보관** — Soul Trace 가 자기 스토리지에 원본을 갖는다.
 *
 * ── 무엇이 문제였나 ─────────────────────────────────────────────────────────
 * `soul_trace_profiles.hero_image_url` 에 들어 있던 값은 DALL·E 가 돌려준 **임시
 * 주소**였다. 한두 시간이면 죽는다. Eternal Beam 은 편지를 가져오는 순간 그
 * 바이트를 자기 스토리지로 복사하지만, 그것은 고객이 **바로 이어서** 넘어왔을
 * 때의 이야기다.
 *
 * 실제로는 이렇게 된다:
 *   편지 생성 → (고객이 화면을 닫는다) → 이틀 뒤 Eternal Beam 으로 이동 → claim
 *   → 원본 주소는 이미 죽어 있다 → 실물 편지에 배경이 없다
 *
 * 편지 본문은 우리 DB 에 있으니 멀쩡한데 배경만 사라진다. 며칠 차이로 같은 제품이
 * 다르게 인쇄되고, 고객도 우리도 왜 그런지 알 수 없다.
 *
 * ── 고치는 방법 ─────────────────────────────────────────────────────────────
 * 생성 **직후** 바이트를 받아 우리 버킷에 넣고, 저장하는 값은 서명 URL 이 아니라
 * **객체 경로**다. 서명은 만료되지만 경로는 만료되지 않는다. 나중에 Eternal Beam
 * 이 claim 할 때 그 자리에서 짧은 서명을 새로 발급한다.
 *
 * ── 실패는 조용히 없음이다 ───────────────────────────────────────────────────
 * 보관에 실패해도 편지 생성을 막지 않는다. `hero_image_url` 은 그대로 남으므로
 * 지금까지의 동작(원본이 살아 있는 동안만 배경이 온다)으로 떨어질 뿐이다.
 * 배경 한 장 때문에 다 쓴 편지를 잃는 것이 훨씬 나쁘다.
 */

import { isAllowedHeroImageFetchUrl } from "./hero-image-proxy.ts";
import { createSupabaseServerClient } from "./supabase-server.ts";

/**
 * 전용 비공개 버킷. 편지 배경 말고는 아무것도 들어가지 않는다 — 다른 자산과
 * 섞으면 정책을 하나 고칠 때마다 무엇이 열리는지 계산해야 한다.
 */
export const HERO_BUCKET = process.env.SOUL_TRACE_HERO_BUCKET?.trim() || "hero-images";

/** 인쇄 배경 한 장의 상한. 없으면 잘못된 응답 하나가 함수 메모리를 먹는다. */
export const MAX_HERO_BYTES = 12 * 1024 * 1024;

/** Eternal Beam 이 claim 할 때 발급하는 서명의 수명(초). 받아서 바로 복사한다. */
export const CLAIM_SIGNED_URL_TTL_SECONDS = 600;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 객체 경로 — **letter_id 로 결정적**이다.
 *
 * 같은 편지를 다시 생성해도 같은 자리에 덮어쓴다. 생성마다 새 경로를 만들면
 * 버킷에 고아 객체가 쌓이고, 어느 것이 정본인지 알 수 없게 된다.
 *
 * 확장자를 `.png` 로 **고정**하는 것도 같은 이유다. 내용에 따라 확장자를 바꾸면
 * 한 편지가 hero.png 와 hero.jpg 를 동시에 가질 수 있다. 읽는 쪽(Eternal Beam
 * 의 PIL)은 확장자가 아니라 매직 바이트를 보므로 이름은 붙잡아 두는 편이 낫다.
 */
export function heroObjectPath(letterId: string): string | null {
  const id = (letterId || "").trim();
  // 경로에 들어가는 값이다. UUID 가 아니면 만들지 않는다 — 경로 조작을 막는
  // 가장 단순한 방법은 모양을 아는 값만 쓰는 것이다.
  if (!UUID_RE.test(id)) return null;
  return `letters/${id.toLowerCase()}/hero.png`;
}

/** 매직 바이트로 판별한다. 서버가 알려 준 Content-Type 은 믿지 않는다. */
export function sniffImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export interface HeroBytes {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * DALL·E 임시 주소 → 바이트.
 *
 * 호스트 허용 목록은 프록시 라우트와 **같은 규칙**을 쓴다. 여기서 아무 주소나
 * 받으면 이 함수가 곧 서버 사이드 요청 위조 도구가 된다.
 */
export async function fetchHeroBytes(
  url: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<HeroBytes | null> {
  const raw = (url || "").trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!isAllowedHeroImageFetchUrl(parsed)) {
    console.error("[hero-store] 허용되지 않은 원본 호스트 — 건너뛴다:", parsed.hostname);
    return null;
  }

  let bytes: Uint8Array;
  try {
    const res = await fetchImpl(raw, {
      headers: { Accept: "image/*" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[hero-store] 원본 응답이 실패다:", res.status);
      return null;
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (reason) {
    console.error("[hero-store] 원본을 받지 못했다:", reason);
    return null;
  }

  if (bytes.length === 0) return null;
  if (bytes.length > MAX_HERO_BYTES) {
    console.error("[hero-store] 원본이 너무 크다:", bytes.length);
    return null;
  }

  // 이미지가 아니면 넣지 않는다. HTML 오류 페이지를 배경이라고 저장하면
  // 인쇄 시점에야 알게 된다 — 그때는 이미 늦다.
  const contentType = sniffImageContentType(bytes);
  if (!contentType) {
    console.error("[hero-store] 이미지가 아니다 — 보관하지 않는다");
    return null;
  }
  return { bytes, contentType };
}

/** 스토리지 이음매. 테스트가 실제 Supabase 없이 이 모듈을 돌릴 수 있게 한다. */
export interface HeroStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<boolean>;
  sign(path: string, ttlSeconds: number): Promise<string | null>;
  saveRef(letterId: string, path: string): Promise<boolean>;
}

type StorageLike = {
  from: (bucket: string) => {
    upload: (
      path: string,
      body: Uint8Array,
      opts: { contentType: string; upsert: boolean },
    ) => Promise<{ error: { message: string } | null }>;
    createSignedUrl: (
      path: string,
      ttl: number,
    ) => Promise<{
      data: { signedUrl?: string } | null;
      error: { message: string } | null;
    }>;
  };
};

type ClientLike = {
  storage: StorageLike;
  from: (table: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export function createHeroStorage(client: ClientLike): HeroStorage {
  return {
    async upload(path, bytes, contentType) {
      // upsert 다. 같은 편지를 다시 생성하면 **덮어쓴다** — 두 번째 객체를
      // 만들면 어느 쪽이 정본인지 알 수 없다.
      const { error } = await client.storage
        .from(HERO_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) {
        console.error("[hero-store] 업로드 실패:", error.message);
        return false;
      }
      return true;
    },
    async sign(path, ttlSeconds) {
      const { data, error } = await client.storage
        .from(HERO_BUCKET)
        .createSignedUrl(path, ttlSeconds);
      if (error || !data?.signedUrl) {
        console.error("[hero-store] 서명 실패:", error?.message ?? "(no url)");
        return null;
      }
      return data.signedUrl;
    },
    async saveRef(letterId, path) {
      // 프로필 upsert 와 **따로** 쓴다. 저 문장에 컬럼을 하나 더 얹으면,
      // 마이그레이션 전 환경에서 편지 저장 자체가 실패한다. 여기서 실패하면
      // 편지는 이미 저장돼 있고 ref 만 없다(= 지금까지의 동작).
      const { error } = await client
        .from("soul_trace_profiles")
        .update({ hero_image_ref: path })
        .eq("letter_id", letterId);
      if (error) {
        console.error("[hero-store] hero_image_ref 저장 실패:", error.message);
        return false;
      }
      return true;
    },
  };
}

/**
 * 생성 직후 한 번 부른다: 받아서 · 넣고 · 경로를 적는다.
 *
 * 돌려주는 값은 **객체 경로**다(서명 URL 이 아니다). 어느 단계에서 실패해도
 * null 이고, 호출부는 그대로 진행한다.
 */
export async function persistHeroImage(args: {
  letterId: string | null;
  heroImageUrl: string | null;
  storage: HeroStorage | null;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const { letterId, heroImageUrl, storage } = args;
  if (!letterId || !heroImageUrl || !storage) return null;

  const path = heroObjectPath(letterId);
  if (!path) {
    console.error("[hero-store] letter_id 모양이 예상과 다르다 — 보관하지 않는다");
    return null;
  }

  const hero = await fetchHeroBytes(heroImageUrl, args.fetchImpl);
  if (!hero) return null;

  if (!(await storage.upload(path, hero.bytes, hero.contentType))) return null;
  // 경로를 적지 못하면 객체는 있어도 아무도 찾지 못한다 — 보관 실패로 친다.
  if (!(await storage.saveRef(letterId, path))) return null;
  return path;
}

/** 환경 변수에서 스토리지를 만든다. 설정이 없으면 null — 보관을 건너뛴다. */
export function createHeroStorageFromEnv(): HeroStorage | null {
  const client = createSupabaseServerClient();
  return client ? createHeroStorage(client as unknown as ClientLike) : null;
}
