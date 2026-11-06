/**
 * Choosing a photo from the phone, and turning it into bytes the bucket takes.
 *
 * Two halves, deliberately split:
 *
 *   * **The picker** (`pickImage`) talks to the platform — the photo library on
 *     iOS and Android, the browser's own file chooser on web. It refuses anything
 *     the bucket would refuse, before a byte is uploaded, so the person gets one
 *     kind sentence instead of a failed upload after a ten-second wait.
 *   * **The decoding** (`base64ToBytes`) is a pure function with a test. The
 *     picker hands back base64 rather than a file handle because that is the one
 *     form that works on every platform this app runs on, and because a
 *     `file://` URL cannot be read by `fetch` on Android.
 *
 * Nothing here decides *where* the image goes: `storage.ts` builds the path and
 * the bucket policy reads the circle id out of it.
 */
import * as ImagePicker from 'expo-image-picker';

import { base64ToBytes } from './bytes';
import { extensionFor, isAllowedImage, MAX_IMAGE_BYTES } from './storage';

export interface PickedImage {
  readonly bytes: Uint8Array;
  /** What the bucket is told this is. */
  readonly mimeType: string;
  /** `jpg`, `png`, `webp`, `heic` — the last part of the object name. */
  readonly extension: string;
  readonly byteLength: number;
  /** A `data:` URI, for showing the person what they just chose. */
  readonly previewUri: string;
}

export type PickResult =
  | { readonly status: 'picked'; readonly image: PickedImage }
  | { readonly status: 'cancelled' }
  /** `permission` — the phone said no. `too_large` / `not_an_image` — we say no. */
  | { readonly status: 'refused'; readonly reason: 'permission' | 'too_large' | 'not_an_image' };

/** One calm sentence per refusal. Shown under the button, never as an alert. */
export const PICK_REFUSAL_COPY: Readonly<
  Record<'permission' | 'too_large' | 'not_an_image', string>
> = {
  permission:
    'We need permission to open your photos. You can allow it in your phone’s settings, and add the picture later.',
  too_large: `That picture is too big. Anything under ${String(
    Math.round(MAX_IMAGE_BYTES / (1024 * 1024)),
  )}MB works — a screenshot of the card is usually clearer anyway.`,
  not_an_image: 'That file isn’t a photo. Choose a JPEG, PNG or HEIC picture.',
};

/**
 * Open the photo library and come back with bytes, or with a reason.
 *
 * `quality` and `allowsEditing` are on because an insurance card is photographed
 * on a kitchen table at an angle: the crop step is where a person straightens it,
 * and a re-encoded JPEG is a fraction of the size of a modern phone photo.
 */
export async function pickImage(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { status: 'refused', reason: 'permission' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
    base64: true,
  });

  if (result.canceled) {
    return { status: 'cancelled' };
  }

  const asset = result.assets[0];

  if (asset === undefined || typeof asset.base64 !== 'string' || asset.base64.length === 0) {
    return { status: 'refused', reason: 'not_an_image' };
  }

  // A picker that does not know the type is a picker that gave us a JPEG: that is
  // what both native pickers re-encode to when `quality` is set.
  const mimeType = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  const bytes = base64ToBytes(asset.base64);
  const extension = extensionFor(mimeType);

  if (extension === null) {
    return { status: 'refused', reason: 'not_an_image' };
  }

  if (!isAllowedImage(mimeType, bytes.byteLength)) {
    return { status: 'refused', reason: 'too_large' };
  }

  return {
    status: 'picked',
    image: {
      bytes,
      mimeType,
      extension,
      byteLength: bytes.byteLength,
      previewUri: `data:${mimeType};base64,${asset.base64}`,
    },
  };
}
