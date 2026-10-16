export type ServerSearchParams = Record<string, string | string[] | undefined>;

export function hrefWithSearchParams(path: string, params: ServerSearchParams): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}
