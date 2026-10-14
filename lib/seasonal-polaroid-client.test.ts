import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildSeasonalPolaroidFormData } from "./seasonal-polaroid-client.ts";

const clientSource = readFileSync("lib/seasonal-polaroid-client.ts", "utf8").replace(/\r\n/g, "\n");
const trialRoute = readFileSync("app/api/seasonal-polaroid/trial/route.ts", "utf8");
const componentSource = readFileSync("components/polaroid-entry.tsx", "utf8");

test("Seasonal client builds the backend multipart contract without photo data URLs", () => {
  const primary = new File([new Uint8Array([1, 2, 3])], "primary.webp", { type: "image/webp" });
  const secondary = new File([new Uint8Array([4, 5, 6])], "second.webp", { type: "image/webp" });
  const form = buildSeasonalPolaroidFormData({
    themeId: "halloween",
    locale: "ko",
    petName: "Mandu",
    species: "dog",
    status: "living",
    costume: "pumpkin",
    scene: "pumpkinPatch",
    vibe: "cuteCozy",
    personalities: ["foodie", "cuddleBug"],
    habit: "toyCarrier",
    favoriteTreat: "pumpkinBiscuit",
    customTreat: "",
    callName: "mom",
    customCallName: "",
    personalDetail: "Loves the autumn leaves",
  }, primary, secondary);

  assert.equal(form.get("themeId"), "halloween");
  assert.equal(form.get("locale"), "ko");
  assert.equal(form.get("petName"), "Mandu");
  assert.equal(form.get("personalities"), JSON.stringify(["foodie", "cuddleBug"]));
  assert.equal((form.get("primaryPhoto") as File).name, primary.name);
  assert.equal((form.get("primaryPhoto") as File).type, primary.type);
  assert.equal((form.get("secondaryPhoto") as File).name, secondary.name);
  assert.equal(form.has("photo"), false);
});

test("Seasonal status capability is transported in a request header, not the query string", () => {
  assert.match(clientSource, /x-soul-trace-seasonal-capability/);
  assert.doesNotMatch(clientSource, /capability: session\.capability/);
});

test("private image retrieval uses the session signal and short-lived token headers", () => {
  assert.match(clientSource, /x-soul-trace-seasonal-image-token/);
  assert.match(clientSource, /signal,\n\s*cache: "no-store"/);
  assert.match(clientSource, /URL\.createObjectURL\(blob\)/);
});

test("developer trial status is explicitly unlimited and the UI does not show a counter", () => {
  assert.match(trialRoute, /limit: "unlimited"/);
  assert.match(trialRoute, /remaining: null/);
  assert.match(componentSource, /developerUnlimited/);
  assert.doesNotMatch(componentSource, /developer_budget_exhausted/);
});
