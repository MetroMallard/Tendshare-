import { describe, expect, it } from 'vitest';

import {
  ALLOWED_IMAGE_TYPES,
  CARE_MEDIA_BUCKET,
  MAX_IMAGE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  buildPath,
  circleIdOfPath,
  extensionFor,
  isAllowedImage,
  isCareMediaPath,
  isSignedUrlStale,
} from './storage';

const CIRCLE = '4d1a1f6e-3b6b-4a1e-9d1c-2f7f1c8f0a11';
const PERSON = '9b2c7a44-1f2e-4c3d-8a5b-6e7d8c9b0a12';

describe('the bucket', () => {
  it('is the private one, by name', () => {
    expect(CARE_MEDIA_BUCKET).toBe('care-media');
  });

  it('expires a signed URL in five minutes', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(300);
  });
});

describe('the object path', () => {
  it('starts with the circle id, which is what the policy reads', () => {
    const path = buildPath({
      circleId: CIRCLE,
      careRecipientId: PERSON,
      kind: 'photo',
      extension: 'jpg',
      at: 1_700_000_000_000,
    });

    expect(path).toBe(`${CIRCLE}/${PERSON}/photo-1700000000000.jpg`);
    expect(circleIdOfPath(path)).toBe(CIRCLE);
  });

  it('names an insurance card after its row, so a replacement is a new object', () => {
    const path = buildPath({
      circleId: CIRCLE,
      careRecipientId: PERSON,
      kind: 'insurance',
      rowId: 'a1b2c3d4',
      extension: 'png',
      at: 42,
    });

    expect(path).toBe(`${CIRCLE}/${PERSON}/insurance-a1b2c3d4-42.png`);
  });

  it('refuses anything this app did not write', () => {
    for (const path of [
      'photo.jpg',
      `${CIRCLE}/photo.jpg`,
      `not-a-circle/${PERSON}/photo-1.jpg`,
      `${CIRCLE}/${PERSON}/photo-1.exe`,
      `${CIRCLE}/${PERSON}/photo-1.jpg/../../other/photo.jpg`,
      '',
    ]) {
      expect(isCareMediaPath(path), path).toBe(false);
      expect(circleIdOfPath(path)).toBeNull();
    }
  });
});

describe('what may be uploaded', () => {
  it('takes the image types the bucket accepts', () => {
    for (const mime of ALLOWED_IMAGE_TYPES) {
      expect(extensionFor(mime)).not.toBeNull();
    }

    expect(extensionFor('image/JPEG')).toBe('jpg');
  });

  it('refuses a PDF or a video', () => {
    expect(isAllowedImage('application/pdf', 1024)).toBe(false);
    expect(isAllowedImage('video/mp4', 1024)).toBe(false);
  });

  it('refuses an empty file and one over the bucket limit', () => {
    expect(isAllowedImage('image/jpeg', 0)).toBe(false);
    expect(isAllowedImage('image/jpeg', MAX_IMAGE_BYTES + 1)).toBe(false);
    expect(isAllowedImage('image/jpeg', MAX_IMAGE_BYTES)).toBe(true);
  });
});

describe('when a signature is stale', () => {
  const now = 1_700_000_000_000;

  it('is fresh for the first four minutes of a five-minute URL', () => {
    expect(isSignedUrlStale(now + 300_000, now)).toBe(false);
    expect(isSignedUrlStale(now + 300_000, now + 60_000)).toBe(false);
  });

  it('is stale inside the last minute, so the image is re-signed rather than half-loaded', () => {
    expect(isSignedUrlStale(now + 300_000, now + 240_000)).toBe(true);
  });

  it('is stale once it has expired', () => {
    expect(isSignedUrlStale(now + 300_000, now + 300_001)).toBe(true);
  });
});
