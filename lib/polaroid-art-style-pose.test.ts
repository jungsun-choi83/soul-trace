import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  POLAROID_FRAME_LAYOUTS,
  GOUACHE_POLAROID_FRAME_SRC,
  FELT_POLAROID_FRAME_SRC,
  CRAYON_POLAROID_FRAME_SRC,
} from "./polaroid-frames.ts";
import { EVERYDAY_POLAROID_ART_STYLE_IDS } from "./polaroid-theme-catalog.ts";
import {
  POLAROID_ART_STYLE_LEADS,
  POLAROID_ART_STYLE_RENDER,
  buildSeasonalPolaroidImagePrompt,
  buildSeasonalPolaroidMemoSystemPrompt,
} from "./seasonal-polaroid-prompts.ts";
import type { SeasonalPolaroidPromptAnswers } from "./seasonal-polaroid-prompts.ts";

const BASE: SeasonalPolaroidPromptAnswers = {
  themeId: "felt-doll",
  locale: "en",
  petName: "Mochi",
  species: "cat",
  status: "living",
  costume: "surprise",
  scene: "tiny-armchair",
  vibe: "cute-cozy",
  personalities: ["cuddle-bug"],
  habit: "sunbeam-napper",
  favoriteTreat: "tuna",
  callName: "mom",
};

const STYLE_CASES = [
  { themeId: "felt-doll", scene: "tiny-armchair", vibe: "cute-cozy", medium: /needle-felted wool/i, render: /wool felt/i },
  { themeId: "gouache-story", scene: "meadow-path", vibe: "bright-story", medium: /gouache storybook illustration/i, render: /gouache illustration/i },
  { themeId: "crayon-diary", scene: "diary-page", vibe: "handmade-warm", medium: /crayon diary drawing/i, render: /crayon-on-paper/i },
] as const;

function promptFor(themeId: string, scene: string, vibe: string, occasionId?: string): string {
  return buildSeasonalPolaroidImagePrompt({ ...BASE, themeId, scene, vibe, ...(occasionId ? { occasionId } : {}) });
}

test("felt, gouache, and crayon each carry their own art medium instructions", () => {
  const prompts = STYLE_CASES.map((item) => promptFor(item.themeId, item.scene, item.vibe));
  assert.equal(new Set(prompts).size, 3, "the three art styles must not share one prompt");

  STYLE_CASES.forEach((item, index) => {
    const prompt = prompts[index]!;
    assert.match(prompt, item.medium, `${item.themeId} must state its own medium`);
    assert.match(prompt, item.render, `${item.themeId} must state its own render rule`);
    assert.doesNotMatch(prompt, /natural-color portrait/i, `${item.themeId} must not fall back to the shared photographic lead`);
    assert.doesNotMatch(prompt, /emotionally natural Halloween photograph/, `${item.themeId} must not reuse the Halloween lead`);
  });

  // No style claims another style's medium. The manager's leads do name the
  // other media as negatives ("never gouache"), so only the positive medium
  // claim is checked here.
  assert.doesNotMatch(prompts[0]!, /gouache storybook illustration|crayon diary drawing/i);
  assert.doesNotMatch(prompts[1]!, /needle-felted wool miniature|crayon diary drawing/i);
  assert.doesNotMatch(prompts[2]!, /needle-felted wool miniature|gouache storybook illustration/i);
});

test("the manager's style definitions are reused rather than replaced", () => {
  assert.deepEqual(Object.keys(POLAROID_ART_STYLE_LEADS).sort(), ["crayon", "felt", "gouache"]);
  assert.deepEqual(Object.keys(POLAROID_ART_STYLE_RENDER).sort(), ["crayon", "felt", "gouache"]);
  // Every lead and render rule must actually reach the prompt.
  const felt = promptFor("felt-doll", "tiny-armchair", "cute-cozy");
  const gouache = promptFor("gouache-story", "meadow-path", "bright-story");
  const crayon = promptFor("crayon-diary", "diary-page", "handmade-warm");
  assert.ok(felt.includes(POLAROID_ART_STYLE_LEADS.felt));
  assert.ok(felt.includes(POLAROID_ART_STYLE_RENDER.felt));
  assert.ok(gouache.includes(POLAROID_ART_STYLE_LEADS.gouache));
  assert.ok(gouache.includes(POLAROID_ART_STYLE_RENDER.gouache));
  assert.ok(crayon.includes(POLAROID_ART_STYLE_LEADS.crayon));
  assert.ok(crayon.includes(POLAROID_ART_STYLE_RENDER.crayon));
  // No art style was added or removed.
  assert.deepEqual([...EVERYDAY_POLAROID_ART_STYLE_IDS], ["felt-doll", "gouache-story", "crayon-diary"]);
});

test("an occasion keeps the chosen medium instead of converting to a photograph", () => {
  for (const item of STYLE_CASES) {
    const prompt = promptFor(item.themeId, item.scene, item.vibe, "spring-secret-garden");
    assert.match(prompt, item.medium, `${item.themeId} must keep its medium under an occasion`);
    assert.match(prompt, /Keep the chosen art medium unchanged/);
    assert.match(prompt, /Do not convert the image into a live-action seasonal snapshot/);
    assert.match(prompt, /secret garden of fresh spring leaves/i);
  }
});

test("pet identity is preserved in the instructions", () => {
  for (const item of STYLE_CASES) {
    const prompt = promptFor(item.themeId, item.scene, item.vibe);
    assert.match(prompt, /IDENTITY VISIBILITY/);
    assert.match(prompt, /IDENTITY THROUGH POSE CHANGE/);
    assert.match(prompt, /identity reference, not as a pose template/i);
    assert.match(prompt, /coat colours and markings/i);
    assert.match(prompt, /ear shape and carriage/i);
    assert.match(prompt, /eye and nose character/i);
    assert.match(prompt, /breed and build/i);
    assert.match(prompt, /Do not swap the breed/i);
    assert.match(prompt, /enough of the face stays visible to preserve identity/i);
    assert.match(prompt, /never add a second animal/i);
  }
});

test("natural pose adaptation is requested for the scene", () => {
  for (const item of STYLE_CASES) {
    const prompt = promptFor(item.themeId, item.scene, item.vibe);
    assert.match(prompt, /POSE AND SCENE FIT/);
    assert.match(prompt, /anatomically plausible pose/i);
    assert.match(prompt, /sitting, standing, lying, walking, or pausing/i);
    // The original pose is kept when it already fits.
    assert.match(prompt, /keep the photo's original pose when it already suits the setting/i);
    // Scene integration.
    assert.match(prompt, /perspective, lighting direction, colour temperature, and scale/i);
    assert.match(prompt, /resting on the ground with a soft contact shadow/i);
    assert.match(prompt, /INTEGRATION:/);
    assert.match(prompt, /Never produce a cutout pasted onto a background/i);
    assert.match(prompt, /extra or missing limbs, duplicated features, or distorted anatomy/i);
    // The manager's framing rule is left untouched by the pose instructions.
    assert.match(prompt, /complete head, both ears, face, neck, and upper body/);
    assert.match(prompt, /do not crop the top of the head, ears, face, or body/i);
    // The pose block must not read as a new questionnaire field.
    assert.doesNotMatch(prompt, /COSTUME:|SCENE:|VIBE:|COSTUME FIT/i);
  }
});

test("no questionnaire question, option, or order was introduced or changed", () => {
  const component = readFileSync("components/polaroid-entry.tsx", "utf8");
  // The four approved steps stay exactly as the manager defined them.
  assert.match(component, /const STEP_IDS = \["meet", "scene", "personality", "preview"\]/);
  // Costume, scene, mood, pose, and position never become questions.
  assert.doesNotMatch(component, /\bcostumeChoice\b|\bsceneChoice\b|\bvibeChoice\b/);
  assert.doesNotMatch(component, /poseChoice|positionChoice|poseLabel|positionLabel/i);
  // The six species options keep their identity and order.
  const species = component.match(/const SPECIES_OPTIONS[\s\S]*?\n\];/)?.[0] ?? "";
  assert.deepEqual(
    [...species.matchAll(/id: "([a-z]+)"/g)].map((match) => match[1]),
    ["dog", "cat", "rabbit", "hamster", "bird", "other"],
  );
  // Hidden legacy values must not leak into an art-style prompt as questions.
  for (const item of STYLE_CASES) {
    const prompt = promptFor(item.themeId, item.scene, item.vibe);
    assert.doesNotMatch(prompt, /COSTUME:|SCENE:|VIBE:|COSTUME FIT/);
    assert.doesNotMatch(prompt, /knit scarf|tiny armchair|cute, cozy/i);
  }
});

test("frames and caption prompts are unchanged by the art-style restoration", () => {
  // The customized frames, including the black floral Gouache card, stay put.
  assert.equal(GOUACHE_POLAROID_FRAME_SRC, "/images/polaroid/black inner floral storybook card-overlay.png");
  assert.equal(FELT_POLAROID_FRAME_SRC, "/images/polaroid/frame-felt-overlay.png");
  assert.equal(CRAYON_POLAROID_FRAME_SRC, "/images/polaroid/frame-crayon-overlay.png");
  assert.equal(POLAROID_FRAME_LAYOUTS.gouache.templateOverlay, true);
  assert.equal(POLAROID_FRAME_LAYOUTS.gouache.templateObjectFit, "contain");
  assert.deepEqual(POLAROID_FRAME_LAYOUTS.gouache.photo, { left: "13.4%", top: "10.2%", width: "73.2%", height: "57.0%" });
  assert.deepEqual(POLAROID_FRAME_LAYOUTS.gouache.caption, { left: "26%", right: "26%", top: "68.2%", bottom: "23.8%" });
  assert.equal(POLAROID_FRAME_LAYOUTS.felt.templateOverlay, true);
  assert.equal(POLAROID_FRAME_LAYOUTS.crayon.templateOverlay, true);

  // Captions stay frame-independent and never name the art medium.
  const captions = STYLE_CASES.map((item) => buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, item.themeId));
  assert.equal(new Set(captions).size, 1, "caption prompts must not depend on the art style");
  for (const caption of captions) {
    assert.doesNotMatch(caption, /needle-felted|gouache|crayon/i);
  }
});
