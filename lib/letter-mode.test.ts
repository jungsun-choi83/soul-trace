import assert from "node:assert/strict";
import { describe, it } from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import type { Messages } from "./i18n.ts";
import { LETTER_MODES, isLetterMode, letterModePath, modeCopy } from "./letter-mode.ts";

const LOCALES: [string, Messages][] = [
  ["ko", ko as unknown as Messages],
  ["en", en as unknown as Messages],
];

describe("모드 판별", () => {
  it("두 갈래만 통과한다", () => {
    assert.ok(isLetterMode("living"));
    assert.ok(isLetterMode("memorial"));
    assert.ok(!isLetterMode("Living"));
    assert.ok(!isLetterMode(""));
    assert.ok(!isLetterMode(undefined));
    // 라우트 이름이 곧 모드다 — 하나를 바꾸면 다른 하나도 깨진다.
    assert.equal(letterModePath("living"), "/living");
    assert.equal(letterModePath("memorial"), "/memorial");
  });
});

describe("갈래별 문구 — 두 언어가 같은 모양이어야 한다", () => {
  for (const [name, messages] of LOCALES) {
    for (const mode of LETTER_MODES) {
      it(`${name}/${mode}: 모드별 기억 질문과 톤 질문이 채워져 있다`, () => {
        const copy = modeCopy(messages, mode);
        assert.equal(copy.memory.length, mode === "living" ? 4 : 5);
        assert.equal(copy.tone.length, 2);
        assert.deepEqual(
          copy.tone.map((q) => q.id),
          ["q10", "q12"],
        );
        for (const item of copy.memory) {
          assert.ok(item.promptText.trim().length > 0);
          assert.ok(item.placeholder.trim().length > 0);
        }
        if (mode === "memorial") {
          // 못다 한 말 질문은 추모 갈래에만 남고 선택적으로 건너뛸 수 있다.
          assert.equal(copy.memory[4].optional, true);
          assert.ok((copy.memory[4].skipLabel ?? "").trim().length > 0);
        } else {
          assert.ok(copy.memory.every((item) => item.optional !== true));
        }
      });

      it(`${name}/${mode}: 화면에 바로 박히는 문구가 비어 있지 않다`, () => {
        const copy = modeCopy(messages, mode);
        for (const key of [
          "landingCta",
          "landingHint",
          "headline",
          "subline",
          "letterHeading",
          "q1Label",
          "q2Label",
          "yearPartedPlaceholder",
        ] as const) {
          assert.ok(copy[key].trim().length > 0, `${key} 가 비어 있다`);
        }
      });
    }

    it(`${name}: 살아 있는 갈래에는 무지개다리 선택지가 없다`, () => {
      const living = modeCopy(messages, "living").tone.map((o) => o.id);
      const memorial = modeCopy(messages, "memorial").tone.map((o) => o.id);
      // 살아 있는 아이에게 "하늘·무지개다리 표현을 빼 달라"고 묻는 것 자체가
      // 아이가 죽었다는 전제를 깔고 있다. 그 선택지는 추모 갈래에만 있어야 한다.
      assert.ok(!living.includes("q11"));
      assert.ok(!memorial.includes("q11"));
    });

    it(`${name}: 톤 선택지 id 는 서버가 아는 값만 쓴다`, () => {
      const known = new Set(["q10", "q12"]);
      for (const mode of LETTER_MODES) {
        for (const option of modeCopy(messages, mode).tone) {
          // 서버의 parseTonePrefs 가 모르는 id 는 조용히 버려진다 —
          // 사용자가 고른 옵션이 편지에 반영되지 않는 조용한 실패다.
          assert.ok(known.has(option.id), `${mode}: 알 수 없는 톤 옵션 ${option.id}`);
        }
      }
    });

    it(`${name}: 두 갈래의 문구가 실제로 다르다`, () => {
      const living = modeCopy(messages, "living");
      const memorial = modeCopy(messages, "memorial");
      assert.notEqual(living.headline, memorial.headline);
      assert.notEqual(living.landingCta, memorial.landingCta);
      assert.notEqual(living.yearPartedPlaceholder, memorial.yearPartedPlaceholder);
    });

    it(`${name}: 편지 길이는 짧게/길게 대신 한 장과 기억을 더 담은 편지로 고른다`, () => {
      for (const mode of LETTER_MODES) {
        const lengthOpts = modeCopy(messages, mode).tone.find((item) => item.id === "q12")?.options ?? [];
        const short = lengthOpts.find((o) => o.id === "short")?.label ?? "";
        const normal = lengthOpts.find((o) => o.id === "normal")?.label ?? "";
        assert.doesNotMatch(short, /12|짧게|Short/);
        assert.doesNotMatch(normal, /20|보통|길게|Medium/);
        assert.ok(short.trim().length > 0);
        assert.ok(normal.trim().length > 0);
        assert.notEqual(short, normal);
      }
    });
  }
});
