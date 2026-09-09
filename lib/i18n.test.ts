import assert from "node:assert/strict";
import { describe, it } from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import type { Messages } from "./i18n.ts";
import { getMessage } from "./i18n.ts";

/**
 * 두 로케일이 어긋나면 화면에 키 경로가 그대로 찍힌다 — `getMessage` 가 못 찾은
 * 경로를 되돌려 주기 때문이다. 조용히 깨지지 않고 눈에 보이는 건 좋지만,
 * 사용자에게 'result.persistenceFailed.title' 이 보이는 건 여전히 사고다.
 *
 * 사람과 에이전트가 같은 파일을 번갈아 고치는 중이라, 이 대조를 사람 눈에
 * 맡기면 반드시 어긋난다.
 */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

const KO = leafPaths(ko).sort();
const EN = leafPaths(en).sort();

describe("로케일 ko / en 대조", () => {
  it("키가 정확히 같다 — 배열 길이까지", () => {
    const onlyKo = KO.filter((k) => !EN.includes(k));
    const onlyEn = EN.filter((k) => !KO.includes(k));
    assert.deepEqual(onlyKo, [], `ko 에만 있는 키: ${onlyKo.join(", ")}`);
    assert.deepEqual(onlyEn, [], `en 에만 있는 키: ${onlyEn.join(", ")}`);
  });

  it("빈 문자열이 없다", () => {
    for (const [name, messages] of [
      ["ko", ko],
      ["en", en],
    ] as const) {
      for (const path of leafPaths(messages)) {
        const value = getMessage(messages as unknown as Messages, path.replace(/\[\d+\]/g, ""));
        if (typeof value === "string" && !path.includes("[")) {
          assert.ok(value.trim().length > 0, `${name}: ${path} 가 비어 있다`);
        }
      }
    }
  });
});

describe("getMessage", () => {
  it("없는 경로는 경로 자체를 돌려준다 — 빈 화면보다 낫다", () => {
    const m = ko as unknown as Messages;
    assert.equal(getMessage(m, "nope.not.here"), "nope.not.here");
    assert.equal(getMessage(m, ""), "");
  });

  it("있는 경로는 문구를 돌려준다", () => {
    const m = ko as unknown as Messages;
    assert.equal(getMessage(m, "hero.title"), "Soul Trace");
    assert.ok(getMessage(m, "result.persistenceFailed.title").includes("저장되지 않았습니다"));
  });
});
