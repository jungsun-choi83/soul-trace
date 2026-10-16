import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("lib/kakao-share.ts", "utf8");
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

test("Kakao sharing uses the official SDK and public JavaScript key", () => {
  assert.match(helper, /t1\.kakaocdn\.net\/kakao_js_sdk/);
  assert.match(helper, /NEXT_PUBLIC_KAKAO_JS_KEY/);
  assert.match(helper, /kakao\.Share\.sendDefault/);
  assert.doesNotMatch(helper, /KAKAO_ADMIN|REST_API|SUPABASE_SERVICE_ROLE/);
});

test("the result share action sends the durable shared-letter URL through Kakao", () => {
  assert.match(flow, /sendKakaoDefaultShare/);
  assert.match(flow, /mobileWebUrl: url/);
  assert.match(flow, /webUrl: url/);
  assert.match(flow, /fetch\("\/api\/letter-share"/);
});
