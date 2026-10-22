/**
 * Extracts the object literal assigned after `marker` in an inline script,
 * e.g. `window.__INITIAL_STATE__['app'] = {...};`. Brace matching is string-aware,
 * so braces inside JSON strings do not break it.
 */
export function extractAssignedJson<T = unknown>(html: string, marker: string): T | undefined {
  const at = html.indexOf(marker);
  if (at < 0) return undefined;
  const start = html.indexOf('{', at + marker.length);
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as T;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
