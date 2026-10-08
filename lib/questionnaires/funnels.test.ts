import assert from "node:assert/strict";
import { describe, it } from "node:test";

import en from "../../locales/en.json" with { type: "json" };
import ko from "../../locales/ko.json" with { type: "json" };
import type { Messages } from "../i18n.ts";
import { LETTER_MODES, modeCopy } from "../letter-mode.ts";
import { funnelFor, LIVING_FUNNEL, MEMORIAL_FUNNEL, memoryIds } from "./index.ts";

const LOCALES: [string, Messages][] = [
  ["ko", ko as unknown as Messages],
  ["en", en as unknown as Messages],
];

describe("independent living and memorial funnels", () => {
  it("does not share one authoritative question list", () => {
    assert.notDeepEqual(memoryIds(LIVING_FUNNEL), memoryIds(MEMORIAL_FUNNEL));
    assert.ok(memoryIds(LIVING_FUNNEL).every((id) => id.startsWith("living-")));
    assert.ok(memoryIds(MEMORIAL_FUNNEL).every((id) => id.startsWith("memorial-")));
    assert.equal(funnelFor("living"), LIVING_FUNNEL);
    assert.equal(funnelFor("memorial"), MEMORIAL_FUNNEL);
  });

  it("living asks about current life, memorial about remembered life", () => {
    const livingKo = modeCopy(ko as unknown as Messages, "living").memory.map((item) => item.promptText).join("\n");
    const memorialKo = modeCopy(ko as unknown as Messages, "memorial").memory.map((item) => item.promptText).join("\n");

    assert.match(livingKo, /하나요\?/);
    assert.match(livingKo, /있나요\?/);
    assert.doesNotMatch(livingKo, /했나요\?|있었나요\?/);
    assert.doesNotMatch(livingKo, /마지막|안녕|무지개|후회|죽음|미안/);

    assert.match(memorialKo, /했나요\?|있었나요\?/);
    assert.doesNotMatch(memorialKo, /하나요\?/);
    assert.doesNotMatch(memorialKo, /어떻게 죽었|마지막 순간|가장 후회|마지막으로 하고 싶은/);
    assert.match(memorialKo, /편안해 보였던/);
    assert.match(memorialKo, /보호자만 아는/);
  });

  it("locale copy ids match each funnel schema and never overlap", () => {
    for (const [, messages] of LOCALES) {
      for (const mode of LETTER_MODES) {
        const funnel = funnelFor(mode);
        const copy = modeCopy(messages, mode);
        assert.deepEqual(
          copy.memory.map((item) => item.id),
          memoryIds(funnel),
        );
        assert.equal(copy.memory.length, funnel.memoryQuestions.length);
        copy.memory.forEach((item, index) => {
          assert.equal(item.optional === true, funnel.memoryQuestions[index]?.required === false);
        });
      }

      const livingIds = new Set(modeCopy(messages, "living").memory.map((item) => item.id));
      const memorialIds = new Set(modeCopy(messages, "memorial").memory.map((item) => item.id));
      for (const id of livingIds) assert.ok(!memorialIds.has(id), `shared memory id ${id}`);

      const livingPrompts = new Set(modeCopy(messages, "living").memory.map((item) => item.promptText));
      for (const prompt of modeCopy(messages, "memorial").memory.map((item) => item.promptText)) {
        assert.ok(!livingPrompts.has(prompt), `shared prompt: ${prompt}`);
      }
    }
  });

  it("tone labels differ so living stays playful and memorial stays memory-centered", () => {
    const living = modeCopy(ko as unknown as Messages, "living").tone[0]?.options.map((option) => option.label) ?? [];
    const memorial = modeCopy(ko as unknown as Messages, "memorial").tone[0]?.options.map((option) => option.label) ?? [];
    assert.deepEqual(living, ["밝고 장난스럽게", "담담하고 다정하게", "따뜻하고 사랑스럽게"]);
    assert.deepEqual(memorial, ["담담하고 차분하게", "따뜻한 위로 중심", "그 아이답고 자연스럽게"]);
    assert.ok(!memorial.includes("밝고 장난스럽게"));
    assert.ok(!living.includes("따뜻한 위로 중심"));
  });
});
