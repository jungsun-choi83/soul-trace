export type LetterStreamDonePayload = {
  personalityType: string;
  personalitySummary: string;
  personalityTags: string[];
  letter: string;
  heroImageUrl: string | null;
  heroImageSkipped: boolean;
  savedPetName: string;
  persistenceFailed?: boolean;
  /**
   * 저장된 편지의 letter_id — Eternal Beam 핸드오프의 source_letter_id.
   * 저장 실패·마이그레이션 전 환경에서는 null 이다.
   */
  letterId?: string | null;
};

type LetterSseHandlers = {
  onLetterDelta: (delta: string) => void;
  onHero: (heroImageUrl: string | null, heroImageSkipped: boolean) => void;
  onDone: (payload: LetterStreamDonePayload) => void;
};

/** POST /api/generate-letter 의 SSE(text/event-stream) 본문 파싱 */
export async function consumeLetterSseStream(
  response: Response,
  handlers: LetterSseHandlers,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body.");
  }

  const decoder = new TextDecoder();
  let carry = "";
  let sawDone = false;

  const processBlock = (raw: string) => {
    const block = raw.trimEnd();
    if (!block) return;
    const lines = block.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload.length === 0) continue;
      let data: unknown;
      try {
        data = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        throw new Error("Invalid server event.");
      }
      if (!data || typeof data !== "object") continue;
      const rec = data as Record<string, unknown>;
      const type = rec.type;
      if (type === "letter" && typeof rec.delta === "string") {
        handlers.onLetterDelta(rec.delta);
      } else if (type === "hero") {
        const url = typeof rec.heroImageUrl === "string" ? rec.heroImageUrl : null;
        const skipped = rec.heroImageSkipped === true;
        handlers.onHero(url, skipped);
      } else if (type === "done") {
        sawDone = true;
        const rawTags = rec.personalityTags;
        const personalityTags = Array.isArray(rawTags)
          ? rawTags.map((x) => String(x))
          : [];
        handlers.onDone({
          personalityType: String(rec.personalityType ?? ""),
          personalitySummary: String(rec.personalitySummary ?? ""),
          personalityTags,
          letter: String(rec.letter ?? ""),
          heroImageUrl: typeof rec.heroImageUrl === "string" ? rec.heroImageUrl : null,
          heroImageSkipped: rec.heroImageSkipped === true,
          savedPetName: String(rec.savedPetName ?? ""),
          persistenceFailed: rec.persistenceFailed === true,
          letterId: typeof rec.letterId === "string" ? rec.letterId : null,
        });
      } else if (type === "error" && typeof rec.message === "string") {
        throw new Error(rec.message);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const parts = carry.split("\n\n");
    carry = parts.pop() ?? "";
    for (const p of parts) {
      processBlock(p);
    }
  }
  if (carry.trim().length > 0) {
    processBlock(carry);
  }

  if (!sawDone) {
    throw new Error("Stream ended before completion.");
  }
}
