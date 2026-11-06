/**
 * Whether a row shows a chevron — the small "this opens something" mark.
 *
 * A chevron used to be suppressed whenever the row carried a trailing element,
 * which meant the rows that most needed the affordance lost it: the primary
 * doctor with a "Main" badge, an insurance card with a "Photo" badge, every
 * allergy with its kind. They looked like plain text next to the rows that
 * opened a sheet, so the person who could edit them had no reason to try.
 *
 * A badge says what a row *is*; a chevron says what it *does*. They are not
 * alternatives, so the decision does not look at the trailing slot at all.
 * `hasTrailing` is in the input only so that this test can state that.
 */
export interface ChevronInput {
  /** The row has an `onPress`. */
  readonly pressable: boolean;
  /** An explicit override from the screen. */
  readonly showChevron?: boolean;
  /** Whether a badge, a pill or an action sits in the trailing slot. */
  readonly hasTrailing: boolean;
}

export function showsChevron({ pressable, showChevron }: ChevronInput): boolean {
  return showChevron ?? pressable;
}
