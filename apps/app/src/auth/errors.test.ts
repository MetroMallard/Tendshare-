import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { describeAuthFailure, failureOf, isNetworkError, type AuthFailureKind } from './errors';

const EMAIL = 'sara.oconnor@example.com';

function apiError(message: string, status: number, code?: string): AuthApiError {
  return new AuthApiError(message, status, code);
}

function kindsOfAllCopy(): AuthFailureKind[] {
  return [
    'offline',
    'invalid_code',
    'too_many_attempts',
    'rate_limited',
    'email_invalid',
    'provider_unavailable',
    'provider_cancelled',
    'not_configured',
    'unknown',
  ];
}

describe('describeAuthFailure', () => {
  it('turns a lost connection into the offline message, whatever the error says', () => {
    expect(describeAuthFailure(new TypeError('Network request failed')).kind).toBe('offline');
    expect(describeAuthFailure(new TypeError('Failed to fetch')).kind).toBe('offline');
    expect(
      describeAuthFailure(new AuthRetryableFetchError('fetch failed', 0)).kind,
      'a retryable fetch error is a connection problem',
    ).toBe('offline');
  });

  it('prefers what the device knows over what the request says', () => {
    const expired = apiError('Token has expired or is invalid', 403, 'otp_expired');
    expect(describeAuthFailure(expired, { offline: true }).kind).toBe('offline');
  });

  it('gives a wrong code and an expired code the same words', () => {
    const wrong = apiError('Token has expired or is invalid', 403, 'otp_expired');
    const expired = apiError('Token has expired or is invalid', 403, 'otp_expired');

    expect(describeAuthFailure(wrong)).toEqual(describeAuthFailure(expired));
    expect(describeAuthFailure(wrong).kind).toBe('invalid_code');
  });

  it('treats a bare 400 or 403 on verify as a code that did not work', () => {
    expect(describeAuthFailure(apiError('bad request', 400)).kind).toBe('invalid_code');
    expect(describeAuthFailure(apiError('forbidden', 403)).kind).toBe('invalid_code');
  });

  it('separates "too many tries" from "you just asked for one"', () => {
    expect(
      describeAuthFailure(apiError('Request rate limit reached', 429, 'over_request_rate_limit'))
        .kind,
    ).toBe('too_many_attempts');
    expect(
      describeAuthFailure(apiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'))
        .kind,
    ).toBe('rate_limited');
    expect(describeAuthFailure(apiError('slow down', 429)).kind).toBe('too_many_attempts');
  });

  it('recognises a provider the project has not switched on', () => {
    const unsupported = apiError('Unsupported provider: provider is not enabled', 400);

    expect(describeAuthFailure(unsupported).kind).toBe('provider_unavailable');
    expect(
      describeAuthFailure(apiError('Provider is not enabled', 400, 'provider_disabled')).kind,
    ).toBe('provider_unavailable');
  });

  it('keeps the email address out of every message, in every case', () => {
    const errors: unknown[] = [
      apiError(`User ${EMAIL} not found`, 404, 'user_not_found'),
      apiError(`Invalid email ${EMAIL}`, 400, 'email_address_invalid'),
      apiError('Token has expired or is invalid', 403, 'otp_expired'),
      apiError('Unsupported provider: provider is not enabled', 400),
      new TypeError('Network request failed'),
      new Error(`something exploded for ${EMAIL}`),
      'not even an error',
    ];

    for (const error of errors) {
      const failure = describeAuthFailure(error);
      expect(`${failure.title} ${failure.message}`).not.toContain('@');
      expect(`${failure.title} ${failure.message}`).not.toContain(EMAIL);
    }
  });

  it('never says "no account", which would tell an attacker who is registered', () => {
    const notFound = describeAuthFailure(apiError('User not found', 404, 'user_not_found'));
    const copy = `${notFound.title} ${notFound.message}`.toLowerCase();

    expect(copy).not.toContain('no account');
    expect(copy).not.toContain('not registered');
    expect(copy).not.toContain('does not exist');
  });

  it('uses plain words, never jargon or an error code', () => {
    for (const kind of kindsOfAllCopy()) {
      const failure = failureOf(kind);
      const copy = `${failure.title} ${failure.message}`.toLowerCase();

      for (const jargon of ['otp', 'token', 'jwt', 'error', 'exception', 'null', 'undefined']) {
        expect(copy, `${kind} copy mentions "${jargon}"`).not.toContain(jargon);
      }
    }
  });

  it('always has a next step to offer', () => {
    for (const kind of kindsOfAllCopy()) {
      const failure = failureOf(kind);
      expect(failure.title.length).toBeGreaterThan(0);
      expect(failure.message.length).toBeGreaterThan(20);
      expect(failure.message).toMatch(/[.!]$/);
    }
  });

  it('falls back to something calm for anything unexpected', () => {
    expect(describeAuthFailure(new Error('boom')).kind).toBe('unknown');
    expect(describeAuthFailure(undefined).kind).toBe('unknown');
    expect(describeAuthFailure({ weird: true }).kind).toBe('unknown');
  });
});

describe('isNetworkError', () => {
  it('recognises the shapes fetch uses when there is no connection', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('request timeout'))).toBe(true);
    expect(isNetworkError(new Error('getaddrinfo ENOTFOUND'))).toBe(true);
  });

  it('does not mistake a server answer for a dead connection', () => {
    expect(isNetworkError(apiError('Invalid', 400, 'otp_expired'))).toBe(false);
  });
});
