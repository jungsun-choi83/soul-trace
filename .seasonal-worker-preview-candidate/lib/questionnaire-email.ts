export function normalizeQuestionnaireEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidQuestionnaireEmail(value: string): boolean {
  const normalized = normalizeQuestionnaireEmail(value);
  if (!normalized || normalized.length > 254) return false;

  const parts = normalized.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !domain || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  if (!/[a-z]/i.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
    return false;
  }
  const topLevelDomain = labels.at(-1) ?? "";
  const mainDomain = labels.at(-2) ?? "";
  if (mainDomain.length < 2) return false;
  return /^[a-z]{2,63}$/i.test(topLevelDomain) || /^xn--[a-z0-9-]{2,59}$/i.test(topLevelDomain);
}
