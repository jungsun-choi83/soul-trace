import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BANNED_LETTER_CLICHES,
  conversationalLetterVoiceRules,
  letterPremiseBlock,
} from "./letter-voice.ts";
import { __internal, buildLetterAddressingBlock } from "./pet-profile.ts";

const { selfIntroSentence, endsWithFinalConsonant } = __internal;

/** 편지 첫 문장은 '엄마, 나 콩이야.' 다. 여기가 틀리면 편지 전체가 어색해진다. */
describe("첫 문장의 '이야/야'", () => {
  it("받침이 있으면 '이야', 없으면 '야'", () => {
    assert.ok(endsWithFinalConsonant("콩"));
    assert.ok(endsWithFinalConsonant("별"));
    assert.ok(!endsWithFinalConsonant("콩이"));
    assert.ok(!endsWithFinalConsonant("루나"));

    assert.equal(selfIntroSentence("콩"), "나 콩이야");
    assert.equal(selfIntroSentence("별"), "나 별이야");
    assert.equal(selfIntroSentence("콩이"), "나 콩이야");
    assert.equal(selfIntroSentence("루나"), "나 루나야");
  });

  it("애칭에 '이'를 덧붙이지 않는다", () => {
    for (const name of ["콩이", "별", "보리", "초코", "봄이"]) {
      const profile = {
        petName: name,
        petNickname: "",
        petType: "dog" as const,
        yearMet: "2015",
        yearParted: "2024",
        letterRecipient: "mom" as const,
        letterRecipientDetail: "",
      };
      const block = buildLetterAddressingBlock("ko", profile, "memorial");
      // '콩이이야' 처럼 '이' 가 겹치면 모델이 그대로 따라 쓴다.
      assert.ok(!block.includes("이이야"), `${name}: '이이야' 가 프롬프트에 들어갔다`);
    }
  });
});

describe("편지 전제 — 갈래별 금지어", () => {
  const KO_DEATH_WORDS = ["무지개다리", "천국", "하늘"];

  it("살아 있는 갈래는 죽음·사후 표현을 금지한다", () => {
    const ko = letterPremiseBlock("ko", "living");
    assert.match(ko, /살아 있다/);
    // 금지 지시가 프롬프트에 실제로 실려 있어야 한다 — 이 문장이 사라지면
    // 살아 있는 아이의 편지에 작별이 섞여 나온다.
    for (const word of KO_DEATH_WORDS) {
      assert.ok(ko.includes(word), `금지 목록에 ${word} 가 없다`);
    }
    assert.match(ko, /절대 금지/);

    const en = letterPremiseBlock("en", "living");
    assert.match(en, /ALIVE/);
    assert.match(en, /rainbow bridge/i);
  });

  it("추모 갈래는 무지개다리 너머에서 말한다", () => {
    assert.match(letterPremiseBlock("ko", "memorial"), /무지개다리 너머/);
    assert.match(letterPremiseBlock("en", "memorial"), /Rainbow Bridge/);
  });

  it("두 갈래의 전제가 서로 다르다", () => {
    for (const locale of ["ko", "en"] as const) {
      assert.notEqual(letterPremiseBlock(locale, "living"), letterPremiseBlock(locale, "memorial"));
    }
  });
});

describe("편지 문체 — 대화체 규칙", () => {
  for (const locale of ["ko", "en"] as const) {
    it(`${locale}: 한 줄에 생각 하나를 지시한다`, () => {
      const rules = conversationalLetterVoiceRules(locale);
      assert.match(rules, locale === "ko" ? /한 줄에 생각 하나/ : /One thought per line/);
    });

    it(`${locale}: AI 상투어를 프롬프트에 이름으로 박아 둔다`, () => {
      const rules = conversationalLetterVoiceRules(locale);
      // 목록을 코드에서 지우면 프롬프트에서도 사라진다 — 그 연결을 잠근다.
      for (const cliche of BANNED_LETTER_CLICHES[locale]) {
        assert.ok(rules.includes(cliche), `금지 멘트 ${cliche} 가 프롬프트에 없다`);
      }
    });

    it(`${locale}: 설문 답만 쓰고 지어내지 말라고 지시한다`, () => {
      const rules = conversationalLetterVoiceRules(locale);
      assert.match(rules, locale === "ko" ? /지어내지|만들지 마/ : /Invent nothing|invent episodes/i);
    });
  }
});
