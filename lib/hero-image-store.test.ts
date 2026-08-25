/**
 * 히어로 이미지 영구 보관 — **며칠 뒤에 와도 배경이 남아 있는가.**
 *
 * 고치려는 결함은 시간에 관한 것이다: 편지 생성과 Eternal Beam claim 사이에
 * 몇 분이 아니라 며칠이 놓일 수 있고, DALL·E 주소는 그때까지 살아 있지 않다.
 * 그래서 여기서 확인하는 것은 "만료된 원본이 더는 문제가 되지 않는가"다.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_BUCKET,
  createHeroStorage,
  fetchHeroBytes,
  heroObjectPath,
  persistHeroImage,
  sniffImageContentType,
  type HeroStorage,
} from "./hero-image-store.ts";

const LETTER = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const DALLE = "https://oaidalleapiprod.blob.core.windows.net/private/img.png";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

function okResponse(bytes: Uint8Array): Response {
  // 사본을 만든다. Response 가 원본 버퍼를 붙잡고 있으면 같은 상수를 쓰는
  // 다른 테스트가 서로에게 영향을 준다.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Response(copy.buffer, { status: 200 });
}

/** 만료된 DALL·E 주소가 실제로 하는 행동 — 403 을 돌려준다. */
function expiredResponse(): Response {
  return new Response("AuthenticationFailed", { status: 403 });
}

interface Recorder extends HeroStorage {
  uploads: { path: string; contentType: string; size: number }[];
  refs: { letterId: string; path: string }[];
}

function recorder(over: Partial<HeroStorage> = {}): Recorder {
  const uploads: Recorder["uploads"] = [];
  const refs: Recorder["refs"] = [];
  return {
    uploads,
    refs,
    async upload(path, bytes, contentType) {
      uploads.push({ path, contentType, size: bytes.length });
      return true;
    },
    async sign(path) {
      return `https://proj.supabase.co/storage/v1/object/sign/${HERO_BUCKET}/${path}?token=t`;
    },
    async saveRef(letterId, path) {
      refs.push({ letterId, path });
      return true;
    },
    ...over,
  };
}

// ── 1. 새로 생성된 히어로는 즉시 보관된다 ───────────────────────────────────

test("생성 직후 바이트가 우리 버킷으로 들어가고 경로가 기록된다", async () => {
  const store = recorder();
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: store,
    fetchImpl: async () => okResponse(PNG),
  });

  assert.equal(ref, `letters/${LETTER}/hero.png`);
  assert.equal(store.uploads.length, 1);
  assert.equal(store.uploads[0]!.contentType, "image/png");
  assert.equal(store.uploads[0]!.size, PNG.length);
  assert.deepEqual(store.refs, [{ letterId: LETTER, path: ref }]);
});

test("저장하는 값은 경로다 — 서명 URL 이 아니다", async () => {
  // 서명을 저장하면 그 서명이 죽는 순간 같은 결함이 그대로 돌아온다.
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: recorder(),
    fetchImpl: async () => okResponse(PNG),
  });
  assert.ok(ref);
  assert.ok(!ref!.includes("http"), ref!);
  assert.ok(!ref!.includes("token"), ref!);
  assert.ok(!ref!.includes("?"), ref!);
});

// ── 2. 원본이 만료돼도 ref 가 있으면 상관없다 ──────────────────────────────

test("보관이 끝난 뒤에는 원본이 죽어도 배경을 잃지 않는다", async () => {
  // 1일차: 보관한다.
  const store = recorder();
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: store,
    fetchImpl: async () => okResponse(PNG),
  });
  assert.ok(ref);

  // 3일차: DALL·E 주소는 죽었다. 그래도 claim 은 **원본을 건드리지 않는다** —
  // 우리 객체에 서명만 새로 발급한다.
  const signed = await store.sign(ref!, 600);
  assert.ok(signed, "만료된 원본과 무관하게 접근 주소가 나와야 한다");
  assert.ok(signed!.includes(ref!));
});

test("만료된 원본만 있고 ref 가 없으면 보관은 실패로 끝난다 — 조용히 성공하지 않는다", async () => {
  const store = recorder();
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: store,
    fetchImpl: async () => expiredResponse(),
  });
  assert.equal(ref, null);
  assert.equal(store.uploads.length, 0, "받지도 못한 것을 올려서는 안 된다");
  assert.equal(store.refs.length, 0, "없는 객체의 경로를 기록해서는 안 된다");
});

// ── 3. 며칠 뒤 claim 해도 같은 경로가 나온다 ───────────────────────────────

test("경로는 letter_id 로만 결정된다 — 시각이나 호출 횟수와 무관하다", () => {
  const a = heroObjectPath(LETTER);
  const b = heroObjectPath(LETTER.toUpperCase());
  assert.equal(a, `letters/${LETTER}/hero.png`);
  assert.equal(b, a, "대소문자가 갈리면 한 편지가 두 객체를 갖는다");
});

// ── 6. 반복 보관이 객체를 늘리지 않는다 ────────────────────────────────────

test("같은 편지를 다시 생성해도 한 객체로 수렴한다", async () => {
  const store = recorder();
  for (let i = 0; i < 3; i++) {
    await persistHeroImage({
      letterId: LETTER,
      heroImageUrl: DALLE,
      storage: store,
      fetchImpl: async () => okResponse(PNG),
    });
  }
  const paths = new Set(store.uploads.map((u) => u.path));
  assert.equal(paths.size, 1, [...paths].join(" · "));
  assert.equal(store.uploads.length, 3, "덮어쓰기지 새 객체가 아니다");
});

// ── 5. 손상/누락은 치명적이지 않다 ──────────────────────────────────────────

test("이미지가 아닌 응답은 보관하지 않는다", async () => {
  // 만료된 스토리지는 200 과 함께 XML/HTML 오류 본문을 주기도 한다. 그것을
  // 배경이라고 저장하면 며칠 뒤 인쇄에서야 알게 된다.
  const store = recorder();
  const html = new TextEncoder().encode("<html>expired</html>");
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: store,
    fetchImpl: async () => okResponse(html),
  });
  assert.equal(ref, null);
  assert.equal(store.uploads.length, 0);
});

test("빈 응답도 보관하지 않는다", async () => {
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: recorder(),
    fetchImpl: async () => okResponse(new Uint8Array()),
  });
  assert.equal(ref, null);
});

test("네트워크가 끊겨도 던지지 않는다 — 편지 생성을 막을 수 없다", async () => {
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: recorder(),
    fetchImpl: async () => {
      throw new Error("ECONNRESET");
    },
  });
  assert.equal(ref, null);
});

test("스토리지 설정이 없으면 조용히 건너뛴다", async () => {
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: null,
    fetchImpl: async () => okResponse(PNG),
  });
  assert.equal(ref, null);
});

test("업로드는 됐는데 경로를 못 적으면 보관 실패다", async () => {
  // 객체는 있어도 아무도 찾지 못한다. 성공이라고 부르면 실제로는 배경이 없다.
  const ref = await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: recorder({ saveRef: async () => false }),
    fetchImpl: async () => okResponse(PNG),
  });
  assert.equal(ref, null);
});

test("히어로가 없는 편지는 아무 일도 하지 않는다", async () => {
  const store = recorder();
  assert.equal(
    await persistHeroImage({ letterId: LETTER, heroImageUrl: null, storage: store }),
    null
  );
  assert.equal(
    await persistHeroImage({ letterId: null, heroImageUrl: DALLE, storage: store }),
    null
  );
  assert.equal(store.uploads.length, 0);
});

// ── 보안 ────────────────────────────────────────────────────────────────────

test("원본 호스트가 제한된다 — 이 함수가 SSRF 도구가 되지 않는다", async () => {
  for (const bad of [
    "http://oaidalleapiprod.blob.core.windows.net/x.png", // https 아님
    "https://evil.example.com/x.png",
    "https://evil.blob.core.windows.net/x.png",
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "not a url",
    "",
  ]) {
    let called = false;
    const got = await fetchHeroBytes(bad, async () => {
      called = true;
      return okResponse(PNG);
    });
    assert.equal(got, null, bad);
    assert.equal(called, false, `요청이 나갔다: ${bad}`);
  }
});

test("letter_id 가 UUID 가 아니면 경로를 만들지 않는다 — 경로 조작 차단", () => {
  for (const bad of ["../../etc/passwd", "a/b", "", "  ", "stl_abc", `${LETTER}/x`]) {
    assert.equal(heroObjectPath(bad), null, bad);
  }
});

test("버킷 이름이 다른 자산과 섞이지 않는다", () => {
  assert.equal(HERO_BUCKET, "hero-images");
});

// ── 형식 판별 ───────────────────────────────────────────────────────────────

test("매직 바이트로 형식을 본다 — 서버가 알려 준 타입을 믿지 않는다", () => {
  assert.equal(sniffImageContentType(PNG), "image/png");
  assert.equal(sniffImageContentType(JPEG), "image/jpeg");
  assert.equal(sniffImageContentType(new TextEncoder().encode("<html>")), null);
  assert.equal(sniffImageContentType(new Uint8Array([1, 2])), null);
});

test("JPEG 이 와도 경로는 hero.png 로 고정된다 — 한 편지 한 객체", async () => {
  const store = recorder();
  await persistHeroImage({
    letterId: LETTER,
    heroImageUrl: DALLE,
    storage: store,
    fetchImpl: async () => okResponse(JPEG),
  });
  assert.equal(store.uploads[0]!.path, `letters/${LETTER}/hero.png`);
  // 이름은 고정이지만 Content-Type 은 사실대로 적는다.
  assert.equal(store.uploads[0]!.contentType, "image/jpeg");
});

// ── Supabase 어댑터 ─────────────────────────────────────────────────────────

test("업로드는 upsert 다 — 재생성이 두 번째 객체를 만들지 않는다", async () => {
  let seen: { upsert: boolean; bucket: string } | null = null;
  const store = createHeroStorage({
    storage: {
      from(bucket: string) {
        return {
          async upload(_p: string, _b: Uint8Array, opts: { upsert: boolean }) {
            seen = { upsert: opts.upsert, bucket };
            return { error: null };
          },
          async createSignedUrl() {
            return { data: { signedUrl: "https://x/y" }, error: null };
          },
        };
      },
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  });

  assert.equal(await store.upload("letters/x/hero.png", PNG, "image/png"), true);
  assert.deepEqual(seen, { upsert: true, bucket: HERO_BUCKET });
});

test("ref 는 프로필 upsert 와 따로 쓴다 — 마이그레이션 전이어도 편지는 저장된다", async () => {
  // 컬럼이 없으면 이 update 만 실패하고, 편지 본문은 이미 저장돼 있다.
  const store = createHeroStorage({
    storage: {
      from: () => ({
        async upload() {
          return { error: null };
        },
        async createSignedUrl() {
          return { data: null, error: { message: "no" } };
        },
      }),
    },
    from: (table: string) => {
      assert.equal(table, "soul_trace_profiles");
      return {
        update: (row: Record<string, unknown>) => {
          assert.deepEqual(Object.keys(row), ["hero_image_ref"], "다른 컬럼을 건드린다");
          return {
            eq: async (col: string) => {
              assert.equal(col, "letter_id");
              return { error: { message: 'column "hero_image_ref" does not exist' } };
            },
          };
        },
      };
    },
  });

  assert.equal(await store.saveRef(LETTER, "letters/x/hero.png"), false);
});

test("서명이 실패하면 null 이다 — 빈 문자열을 주소인 척 넘기지 않는다", async () => {
  const store = createHeroStorage({
    storage: {
      from: () => ({
        async upload() {
          return { error: null };
        },
        async createSignedUrl() {
          return { data: null, error: { message: "Object not found" } };
        },
      }),
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  });
  assert.equal(await store.sign("letters/x/hero.png", 600), null);
});

// ── S2S 계약 — 라우트가 실제로 이 모듈을 쓰는가 ─────────────────────────────

test("생성 라우트가 편지 저장 뒤에 히어로를 보관한다 (두 경로 모두)", async () => {
  // letter_id 가 있어야 객체 경로가 결정된다. 저장 전에 부르면 경로가 없다.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/api/generate-letter/route.ts", "utf8");

  const calls = src.match(/await persistHeroForLetter\(saveResult\.letterId, heroImageUrl\)/g);
  assert.equal(calls?.length, 2, "스트리밍/비스트리밍 두 경로 모두에 있어야 한다");

  // 응답 전에 마친다. after() 로 미루면 함수가 먼저 끝나는 환경에서 조용히
  // 유실되고, 그러면 고치려던 결함이 그대로 남는다.
  assert.ok(!/after\(\s*\(\)\s*=>[\s\S]{0,200}persistHero/.test(src), "보관이 after() 뒤로 밀렸다");
});

test("보관 실패가 편지 생성을 막지 않는다", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/api/generate-letter/route.ts", "utf8");
  const i = src.indexOf("async function persistHeroForLetter");
  const fn = src.slice(i, i + 1400);
  assert.ok(/try\s*{/.test(fn) && /catch/.test(fn), "예외가 새어 나간다");
  assert.ok(!/throw/.test(fn), "보관 실패로 편지를 잃는다");
});

test("S2S 는 ref 를 우선하고, 서명은 그 자리에서 새로 만든다", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/api/internal/letter/route.ts", "utf8");

  assert.match(src, /hero_image_ref/);
  assert.match(src, /CLAIM_SIGNED_URL_TTL_SECONDS/);
  // 저장된 서명을 그대로 넘기면 그 서명이 죽는 순간 같은 문제가 반복된다.
  assert.match(src, /\.sign\(heroImageRef, CLAIM_SIGNED_URL_TTL_SECONDS\)/);
  // 레거시 폴백이 남아 있어야 한다 — 보관 이전 편지들이 있다.
  assert.match(src, /profile\.hero_image_url/);
});

test("ref 조회 실패가 편지 전달을 막지 않는다 — 토큰은 이미 소비됐다", async () => {
  // 위 select 에 컬럼을 얹으면 마이그레이션 전 환경에서 문장 전체가 실패하고,
  // 그때는 핸드오프 토큰이 이미 소비된 뒤라 편지를 영영 못 가져온다.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/api/internal/letter/route.ts", "utf8");

  const main = src.slice(
    src.indexOf('.select(\n      "letter_id'),
    src.indexOf("const profile = profileRaw")
  );
  assert.ok(!main.includes("hero_image_ref"), "본문 조회에 ref 컬럼이 섞였다");
  assert.match(src, /refError[\s\S]{0,200}console\.error/);
});

test("버킷은 공개가 아니다", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync("supabase/migration_add_hero_image_ref.sql", "utf8");
  assert.match(sql, /'hero-images',\s*\n\s*false/);
  assert.ok(!/create policy/i.test(sql), "버킷에 쓰기/읽기 정책이 추가됐다");
});
