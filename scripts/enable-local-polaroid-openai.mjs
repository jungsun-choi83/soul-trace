import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const LOCAL = ".env.local";
const SOURCE = ".env.vercel.production";
const COPY_KEYS = ["OPENAI_API_KEY", "SOUL_TRACE_SERVICE_TOKEN"];
const FORCE_TRUE = [
  "SOUL_TRACE_SEASONAL_POLAROID_ENABLED",
  "SOUL_TRACE_POLAROID_YEARROUND_ENABLED",
  "NEXT_PUBLIC_POLAROID_YEARROUND_ENABLED",
  "SOUL_TRACE_POLAROID_SEASON_CHRISTMAS_ENABLED",
  "NEXT_PUBLIC_POLAROID_SEASON_CHRISTMAS_ENABLED",
];

function parseEnv(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    if (!raw || raw.startsWith("#") || !raw.includes("=")) continue;
    const index = raw.indexOf("=");
    map.set(raw.slice(0, index).trim(), raw.slice(index + 1));
  }
  return map;
}

function meaningful(value) {
  const trimmed = String(value ?? "").trim().replace(/^["']|["']$/g, "");
  return trimmed.length >= 8 ? trimmed : "";
}

const source = existsSync(SOURCE) ? parseEnv(readFileSync(SOURCE, "utf8")) : new Map();
const local = existsSync(LOCAL) ? parseEnv(readFileSync(LOCAL, "utf8")) : new Map();
const report = [];

for (const key of COPY_KEYS) {
  const incoming = meaningful(source.get(key));
  if (!incoming) {
    report.push(`${key}: not copied`);
    continue;
  }
  if (meaningful(local.get(key))) {
    report.push(`${key}: already present`);
    continue;
  }
  local.set(key, incoming);
  report.push(`${key}: copied`);
}

for (const key of FORCE_TRUE) {
  local.set(key, "true");
  report.push(`${key}: true`);
}

for (const key of ["AI_GENERATION_GUARD_SECRET", "AI_GENERATION_WORKER_SECRET"]) {
  if (meaningful(local.get(key))) {
    report.push(`${key}: already present`);
    continue;
  }
  const incoming = meaningful(source.get(key));
  local.set(key, incoming || randomBytes(32).toString("hex"));
  report.push(`${key}: ${incoming ? "copied" : "generated"}`);
}

const lines = [];
for (const [key, value] of local) lines.push(`${key}=${value}`);
writeFileSync(LOCAL, `${lines.join("\n")}\n`, "utf8");
console.log(report.join("\n"));
console.log("openai_ready:", Boolean(meaningful(local.get("OPENAI_API_KEY"))));
console.log("generation_ready:", local.get("SOUL_TRACE_SEASONAL_POLAROID_ENABLED") === "true");
