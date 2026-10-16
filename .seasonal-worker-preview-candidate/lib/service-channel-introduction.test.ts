import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import type { Messages } from "./i18n.ts";
import { surveyIntroduction } from "./survey.ts";
import { parseServiceChannel } from "./service-channel.ts";

const english = en as unknown as Messages;
const korean = ko as unknown as Messages;
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

const expected = {
  pension: {
    en: {
      headline: "What would they tell you from their stay?",
      subline:
        "Share the comfortable, playful, and little moments from today. We’ll turn them into a warm letter from your pet.",
    },
    ko: {
      headline: "머무는 동안 어떤 이야기를 전하고 싶을까요?",
      subline:
        "오늘 편안하고 즐거웠던 작은 순간들을 들려주세요. 반려동물의 따뜻한 편지로 전해 드릴게요.",
    },
  },
  grooming: {
    en: {
      headline: "How did they shine today?",
      subline: "Tell us about their fresh look, mood, and most charming moment.",
    },
    ko: {
      headline: "오늘 어떤 모습으로 빛났을까요?",
      subline: "새로워진 모습과 기분, 가장 사랑스러웠던 순간을 들려주세요.",
    },
  },
  hospital: {
    en: {
      headline: "What would they tell you about today’s visit?",
      subline: "Share the calm and caring moments from today.",
    },
    ko: {
      headline: "오늘의 방문에서 어떤 이야기를 전하고 싶을까요?",
      subline: "오늘 함께한 차분하고 따뜻한 순간을 들려주세요.",
    },
  },
} as const;

test("living service channels receive the exact localized introduction", () => {
  for (const channel of ["pension", "grooming", "hospital"] as const) {
    assert.deepEqual(surveyIntroduction(english, "living", channel), expected[channel].en);
    assert.deepEqual(surveyIntroduction(korean, "living", channel), expected[channel].ko);
  }
});

test("missing and invalid channels retain the original living introduction", () => {
  const original = {
    headline: english.modes.living.headline,
    subline: english.modes.living.subline,
  };

  assert.deepEqual(surveyIntroduction(english, "living", null), original);
  assert.deepEqual(
    surveyIntroduction(english, "living", parseServiceChannel("invalid")),
    original,
  );
});

test("legacy funeral uses the unmodified normal memorial introduction", () => {
  const original = {
    headline: english.modes.memorial.headline,
    subline: english.modes.memorial.subline,
  };

  assert.deepEqual(surveyIntroduction(english, "memorial", "funeral"), original);
  assert.deepEqual(surveyIntroduction(korean, "memorial", "funeral"), {
    headline: korean.modes.memorial.headline,
    subline: korean.modes.memorial.subline,
  });
});

test("locale changes only select copy and do not mutate typed answers", () => {
  const answers = ["A typed answer", "두 번째 답변"];
  const snapshot = [...answers];

  surveyIntroduction(english, "living", "pension");
  surveyIntroduction(korean, "living", "pension");

  assert.deepEqual(answers, snapshot);
});

test("SSR and first browser render use the same server-provided channel introduction", () => {
  assert.match(flow, /const serviceChannel = initialServiceChannel;/);
  assert.match(flow, /surveyIntroduction\(messages, mode, serviceChannel\)/);
  assert.doesNotMatch(
    flow,
    /parseServiceChannel\(new URLSearchParams\(window\.location\.search\)/,
  );
  assert.doesNotMatch(flow, /suppressHydrationWarning|\bmounted\b/);
});
