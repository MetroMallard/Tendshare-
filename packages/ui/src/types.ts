/**
 * Tones and shared prop shapes. Kept out of the component files so the barrel
 * can export them without pulling a renderer in.
 */

/** Semantic text colours. A tone, never a hex value, at the call site. */
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

/** Background tones a card can take without inventing a new colour. */
export type SurfaceTone = 'surface' | 'raised' | 'sunken' | 'muted' | 'brandSoft' | 'accentSoft';

export type ControlSize = 'small' | 'medium' | 'large';
