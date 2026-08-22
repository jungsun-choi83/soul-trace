import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { consumeLetterSseStream, type LetterStreamDonePayload } from "./consume-letter-sse.ts";

/**
 * 회귀 방지 — **저장 실패가 조용한 성공으로 보이면 안 된다.**
 *
 * 실제로 있었던 일: 편지는 스트리밍으로 완벽하게 보였고, HTTP 는 200 이었고,
 * DB 에는 아무것도 없었다. 서버는 persistenceFailed 를 보내고 있었지만
 * 화면이 그것을 읽지 않았다. 그래서 "성공처럼 보이는 실패"가 됐다.
 */

function sseResponse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(new TextEncoder().encode(body));
}

async function collectDone(events: unknown[]): Promise<LetterStreamDonePayload> {
  let done: LetterStreamDonePayload | null = null;
  await consumeLetterSseStream(sseResponse(events), {
    onLetterDelta: () => {},
    onHero: () => {},
    onDone: (p) => { done = p; },
  });
  assert.ok(done, "done 이벤트가 전달되지 않았다");
  return done as unknown as LetterStreamDonePayload;
}

const BASE_DONE = {
  type: "done",
  personalityType: "햇살 같은 아이",
  personalitySummary: "요약",
  personalityTags: ["밝음", "다정", "활발"],
  letter: "엄마, 나 보리야.",
  heroImageUrl: null,
  heroImageSkipped: true,
  savedPetName: "보리",
};

describe("저장 성공", () => {
  it("letterId 를 그대로 전달한다 — 핸드오프의 traceId 가 된다", async () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const done = await collectDone([{ ...BASE_DONE, persistenceFailed: false, letterId: id }]);
    assert.equal(done.letterId, id);
    assert.equal(done.persistenceFailed, false);
    assert.equal(done.letter, "엄마, 나 보리야.");
  });
});

describe("저장 실패", () => {
  it("persistenceFailed 가 true 로 올라온다 — 삼켜지지 않는다", async () => {
    const done = await collectDone([{ ...BASE_DONE, persistenceFailed: true, letterId: null }]);
    assert.equal(done.persistenceFailed, true);
    assert.equal(done.letterId, null);
  });

  it("letterId 가 없으면 null 이다 — 핸드오프를 시작할 수 없음이 드러난다", async () => {
    const done = await collectDone([{ ...BASE_DONE, persistenceFailed: true }]);
    assert.equal(done.letterId, null);
  });

  it("필드가 아예 없는 옛 서버 응답도 안전하게 처리한다", async () => {
    const done = await collectDone([BASE_DONE]);
    assert.equal(done.persistenceFailed, false);
    assert.equal(done.letterId, null);
  });
});

describe("스트림 무결성", () => {
  it("done 없이 끝나면 실패로 본다 — 반쪽 응답을 성공으로 읽지 않는다", async () => {
    await assert.rejects(
      consumeLetterSseStream(sseResponse([{ type: "letter", delta: "안녕" }]), {
        onLetterDelta: () => {}, onHero: () => {}, onDone: () => {},
      }),
      /Stream ended before completion/,
    );
  });

  it("error 이벤트는 예외로 올라온다", async () => {
    await assert.rejects(
      consumeLetterSseStream(sseResponse([{ type: "error", message: "생성 실패" }]), {
        onLetterDelta: () => {}, onHero: () => {}, onDone: () => {},
      }),
      /생성 실패/,
    );
  });
});

/**
 * 소스 수준 고정. 위 테스트는 "화면이 값을 받을 수 있다"까지만 보장하고,
 * 실제로 **읽어서 쓰는지**는 보장하지 못한다. 조용한 실패가 바로 그 틈에서 나왔다.
 */
describe("구조 고정 — 서버가 보내고 화면이 읽는다", () => {
  const route = readFileSync("app/api/generate-letter/route.ts", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");

  it("서버의 done 이벤트가 persistenceFailed 와 letterId 를 싣는다", () => {
    const done = route.slice(route.indexOf('type: "done"'));
    assert.ok(done.includes("persistenceFailed"), "done 에 persistenceFailed 가 없다");
    assert.ok(done.includes("letterId"), "done 에 letterId 가 없다");
  });

  it("화면이 persistenceFailed 를 상태로 반영한다", () => {
    assert.ok(
      /persistenceFailed:\s*data\.persistenceFailed\s*===\s*true/.test(page),
      "onDone 이 persistenceFailed 를 무시하고 있다 — 조용한 실패가 돌아온다",
    );
  });

  it("화면이 저장 실패를 사용자에게 **보여 준다**", () => {
    assert.ok(
      page.includes("result.persistenceFailed.title"),
      "저장 실패 경고 배너가 없다 — 사용자는 저장됐다고 믿고 창을 닫는다",
    );
  });

  it("서버가 Supabase 실패의 code/details/hint 를 남긴다", () => {
    assert.ok(route.includes("logSupabaseFailure"), "진단 로깅이 없다");
    assert.ok(
      route.includes("error.code") || route.includes("code=${error.code"),
      "Supabase error.code 를 로그에 남기지 않는다 — 원인 구분이 불가능하다",
    );
  });

  it("진단 로그가 브라우저로 나가지 않는다 (서버 콘솔 전용)", () => {
    const fn = route.slice(
      route.indexOf("function logSupabaseFailure"),
      route.indexOf("function logSupabaseFailure") + 900,
    );
    assert.ok(fn.includes("console.error"), "서버 로그가 아니다");
    assert.ok(!fn.includes("send("), "진단이 SSE 로 나가고 있다");
    assert.ok(!fn.includes("NextResponse"), "진단이 HTTP 응답으로 나가고 있다");
  });
});
