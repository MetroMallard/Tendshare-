/**
 * What a row says out loud.
 *
 * A pressable row is one accessibility element, so its spoken label is built
 * here rather than left to the platform to stitch together from the fragments
 * on screen — otherwise a screen reader reads a name, then a badge, then half a
 * sentence, with no telling which belongs to which.
 *
 * The rule is one sentence per thought: the title, then the subtitle, each
 * ending in a full stop so a screen reader pauses between them. A row whose
 * visible text does not say everything it shows (a role badge, for instance)
 * passes `spokenLabel` and takes over completely.
 *
 * Kept free of React Native imports so it can be tested without rendering.
 */

export interface ListRowLabelInput {
  readonly title: string;
  readonly subtitle?: string;
  /** Replaces the composed label entirely. */
  readonly spokenLabel?: string;
}

/** One sentence: trimmed, with exactly one full stop at the end. */
function sentence(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return '';
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function listRowAccessibilityLabel({
  title,
  subtitle,
  spokenLabel,
}: ListRowLabelInput): string {
  if (spokenLabel !== undefined && spokenLabel.trim().length > 0) {
    return spokenLabel.trim();
  }

  const parts = [sentence(title), subtitle === undefined ? '' : sentence(subtitle)].filter(
    (part) => part.length > 0,
  );

  return parts.join(' ');
}
