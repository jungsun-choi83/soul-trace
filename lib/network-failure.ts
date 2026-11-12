/**
 * Transport-level failure handling for browser requests.
 *
 * `fetch` rejects when the request never produced a response: the device is
 * offline, DNS or TLS failed, the connection dropped mid-flight, or the tab
 * aborted it. An unhandled rejection inside a submit handler skips the lines
 * that release the pending flag, which leaves a form spinning and its submit
 * button disabled with no way back.
 *
 * `fetchOrNull` turns that rejection into a `null` response so callers release
 * pending state and surface a retryable error on the same path they already
 * use for a failed HTTP status.
 *
 * A null response is deliberately ambiguous: the server may or may not have
 * processed the request. Callers must not retry automatically, and anything
 * that creates a record or starts a paid generation must keep reusing its
 * idempotency key so a manual retry is de-duplicated server side.
 */
export async function fetchOrNull(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}

/** Reads a JSON body without throwing on an empty, truncated, or non-JSON response. */
export async function jsonOrNull<T>(response: Response | null): Promise<T | null> {
  if (!response) return null;
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

/** True when the request produced no usable response, whether transport or status. */
export function requestFailed(response: Response | null): boolean {
  return !response || !response.ok;
}
