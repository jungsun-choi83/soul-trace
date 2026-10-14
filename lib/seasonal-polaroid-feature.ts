/**
 * Server-side activation gate. An absent, malformed, or false value keeps
 * Seasonal generation disabled. This is intentionally independent from the
 * client questionnaire so a browser cannot activate the feature.
 */
export function isSeasonalPolaroidEnabled(): boolean {
  return process.env.SOUL_TRACE_SEASONAL_POLAROID_ENABLED?.trim().toLowerCase() === "true";
}
