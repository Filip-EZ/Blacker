/** Error message with its cause chain (Drizzle hides the real database error in `cause`). */
export function errorMessage(err: unknown): string {
  const parts: string[] = [];
  for (let e: unknown = err; e != null && parts.length < 5; e = (e as { cause?: unknown }).cause) {
    parts.push(e instanceof Error ? e.message : String(e));
    if (!(e instanceof Error)) break;
  }
  return parts.join(' ← ');
}
