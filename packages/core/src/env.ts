/** Reads an env var, dropping whitespace and wrapping quotes (easy to paste into GitHub Secrets straight from .env). */
export function envValue(name: string): string | undefined {
  const raw = process.env[name]?.trim().replace(/^(["'])(.*)\1$/s, '$2').trim();
  return raw || undefined;
}
