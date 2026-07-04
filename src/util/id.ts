/**
 * Generate a reasonably-unique id without external deps.
 * Uses crypto.randomUUID when available, else a timestamp+random fallback.
 */
export function newId(prefix = 'id'): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return `${prefix}-${c.randomUUID()}`;
  }
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
