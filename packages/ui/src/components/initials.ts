/**
 * The initials in an avatar: "Margaret Chen" -> "MC".
 *
 * Pure and on its own so it can be tested in Node, without a renderer or React
 * Native. `Avatar` draws the fallback glyph for an empty result.
 */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return `${first}${last}`.toUpperCase();
}
