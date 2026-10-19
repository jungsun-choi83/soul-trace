import { completedResultKey } from "./completed-result-session.ts";
import type { LetterMode } from "./letter-mode.ts";
import { questionnaireDraftKey } from "./questionnaire-draft.ts";
import type { ServiceChannel } from "./service-channel.ts";

type SessionStorageRemover = Pick<Storage, "removeItem">;

/** Clears only the active Letter context when the user explicitly starts again. */
export function clearLetterExperienceSession(
  storage: SessionStorageRemover,
  mode: LetterMode,
  channel: ServiceChannel | null | undefined,
): void {
  storage.removeItem(questionnaireDraftKey(mode, channel));
  storage.removeItem(completedResultKey(mode, channel));
  storage.removeItem(`soul-trace-pending-generation:${mode}:${channel ?? "default"}`);
}
