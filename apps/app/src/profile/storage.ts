/**
 * Photos and insurance cards, and the rules that keep them private.
 *
 * The bucket is `care-media`: private, no public objects, reached only through a
 * signed URL that expires in five minutes. Everything in this file is pure so the
 * rules can be tested without a network or a renderer — the one function that
 * talks to Supabase is a thin wrapper at the bottom.
 *
 * ## The path is the policy
 *
 * Every object path starts with the circle id:
 *
 *   {circle_id}/{care_recipient_id}/photo-{epoch}.{ext}
 *   {circle_id}/{care_recipient_id}/insurance-{row_id}-{epoch}.{ext}
 *
 * The policies in `20261106120100_care_media_bucket.sql` read that first folder
 * and ask `has_circle_role()` about it, which is how one circle's files are
 * unreachable from another. The circle id being first is not a convention: it is
 * the only part of the path a policy can check without a join, and `buildPath`
 * below is the only place that decides it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The one bucket this product stores images in. Private, always. */
export const CARE_MEDIA_BUCKET = 'care-media';

/**
 * How long a signed URL lives.
 *
 * Five minutes: long enough for a screen to load a photo over a slow phone
 * connection, short enough that a URL copied out of a browser tab is useless by
 * the time anybody pastes it anywhere.
 */
export const SIGNED_URL_TTL_SECONDS = 300;

/** Re-sign this long before expiry, so a slow image request never 403s. */
export const SIGNED_URL_REFRESH_SKEW_SECONDS = 60;

export type MediaKind = 'photo' | 'insurance';

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** What the bucket will accept. Anything else is refused before it is uploaded. */
export const ALLOWED_IMAGE_TYPES: readonly string[] = Object.keys(EXTENSION_BY_MIME);

/** Ten megabytes, the bucket's own limit. Checked here so the message is kind. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function extensionFor(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? null;
}

export function isAllowedImage(mimeType: string, bytes: number): boolean {
  return extensionFor(mimeType) !== null && bytes > 0 && bytes <= MAX_IMAGE_BYTES;
}

export interface PathInput {
  readonly circleId: string;
  readonly careRecipientId: string;
  readonly kind: MediaKind;
  /** The insurance row's id, so a replaced photo can be found and deleted. */
  readonly rowId?: string;
  readonly extension: string;
  /** Milliseconds. Passed in so the test can pin it. */
  readonly at: number;
}

/**
 * The object path for a new image.
 *
 * A timestamp in the file name means a replacement is a new object rather than an
 * overwrite: the old one is deleted deliberately, and a failed upload never
 * destroys the photo it was replacing.
 */
export function buildPath(input: PathInput): string {
  const name =
    input.kind === 'insurance'
      ? `insurance-${input.rowId ?? 'card'}-${String(input.at)}.${input.extension}`
      : `photo-${String(input.at)}.${input.extension}`;

  return `${input.circleId}/${input.careRecipientId}/${name}`;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_PATTERN = new RegExp(
  `^${UUID}/${UUID}/(photo|insurance)-[A-Za-z0-9_-]+\\.(jpg|jpeg|png|webp|heic|heif)$`,
  'i',
);

/**
 * Does this look like a path this app wrote?
 *
 * Used before a stored path is turned into a signed URL, so a value that somehow
 * arrived from elsewhere cannot become a request for an object in another
 * circle.
 */
export function isCareMediaPath(path: string): boolean {
  return PATH_PATTERN.test(path);
}

/** The circle id a path belongs to, or null. Mirrors `storage_circle_id()` in SQL. */
export function circleIdOfPath(path: string): string | null {
  if (!isCareMediaPath(path)) {
    return null;
  }

  return path.split('/')[0] ?? null;
}

/**
 * Has this signature expired, or is it about to?
 *
 * `expiresAt` is a millisecond epoch. The skew means an image requested just
 * before expiry is re-signed rather than half-loaded.
 */
export function isSignedUrlStale(
  expiresAt: number,
  now: number,
  skewSeconds: number = SIGNED_URL_REFRESH_SKEW_SECONDS,
): boolean {
  return now >= expiresAt - skewSeconds * 1000;
}

export interface SignedUrl {
  readonly url: string;
  /** Millisecond epoch at which the URL stops working. */
  readonly expiresAt: number;
}

/**
 * Sign a path for a short read.
 *
 * Signing is itself an RLS-checked request: Storage asks whether this session may
 * read the object before it hands out a URL. A visiting helper, a member of
 * another circle and a signed-out visitor all get an error here rather than a
 * link, which is why the expiry is the second line of defence rather than the
 * first.
 *
 * Answers `null` on any failure: a photo that cannot be shown is a missing
 * photo, not a broken screen.
 */
export async function signCareMediaPath(
  client: SupabaseClient,
  path: string,
  now: number = Date.now(),
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<SignedUrl | null> {
  if (!isCareMediaPath(path)) {
    return null;
  }

  const { data, error } = await client.storage
    .from(CARE_MEDIA_BUCKET)
    .createSignedUrl(path, ttlSeconds);

  if (error !== null || data === null || data.signedUrl.length === 0) {
    return null;
  }

  return { url: data.signedUrl, expiresAt: now + ttlSeconds * 1000 };
}
