export type AiUpstreamFailure = "rate_limited" | "timeout" | "upstream";

export function classifyAiUpstreamFailure(error: unknown): AiUpstreamFailure {
  const detail = error && typeof error === "object"
    ? error as { status?: unknown; name?: unknown; code?: unknown }
    : {};
  if (detail.status === 429) return "rate_limited";
  const text = `${detail.name ?? ""} ${detail.code ?? ""}`.toLowerCase();
  if (text.includes("timeout") || text.includes("abort")) return "timeout";
  return "upstream";
}

export function aiUpstreamHttpResponse(error: unknown, message: string): Response {
  const kind = classifyAiUpstreamFailure(error);
  if (kind === "rate_limited") {
    return Response.json({ error: message }, { status: 429, headers: { "Retry-After": "30" } });
  }
  if (kind === "timeout") {
    return Response.json({ error: message }, { status: 504 });
  }
  return Response.json({ error: message }, { status: 502 });
}
