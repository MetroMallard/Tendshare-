import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { groupAsOneElement } from './grouping';

/**
 * The accessibility contract for containers that hold a control.
 *
 * Two layers, because the bug this pins was invisible to every other test we
 * have:
 *
 *   1. the decision itself, as a pure function, and
 *   2. a scan of the component sources for the pattern that caused it — a
 *      container marked `accessible` in a file that renders something
 *      pressable. A container marked `accessible` swallows its children, so
 *      "Try again" on the members screen and "Remove" on the invite rows were
 *      visible, tappable, and unreachable by VoiceOver.
 *
 * The scan is deliberately blunt: if a component file renders a control, its
 * `accessible` props have to be decided in code (`accessible={…}`), never
 * asserted with the bare shorthand.
 */

const componentsDir = fileURLToPath(new URL('.', import.meta.url));

/** Drop comments, so prose about accessibility is not read as code. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');
}

/** `accessible` written as a bare prop: `accessible ` or `accessible>`. */
const BARE_ACCESSIBLE = /(^|[\s{])accessible(?=[\s/>])/m;

/** Anything in a component that a finger or a screen reader can activate. */
const RENDERS_A_CONTROL = /<(Pressable|Button|Switch|TextField|ListRow|OptionList)\b/;

function componentFiles(): string[] {
  return readdirSync(componentsDir)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => join(componentsDir, name));
}

describe('groupAsOneElement', () => {
  it('groups a block of text, so it is read as one sentence', () => {
    expect(groupAsOneElement(false)).toBe(true);
  });

  it('never groups a container that holds a control', () => {
    // The whole point: a parent marked `accessible` makes its children
    // unreachable, so a button inside it can only be found by sight.
    expect(groupAsOneElement(true)).toBe(false);
  });
});

describe('component sources', () => {
  it('never mark a container accessible in a file that renders a control', () => {
    const offenders = componentFiles()
      .filter((file) => {
        const source = stripComments(readFileSync(file, 'utf8'));

        return RENDERS_A_CONTROL.test(source) && BARE_ACCESSIBLE.test(source);
      })
      .map((file) => relative(componentsDir, file));

    expect(offenders).toEqual([]);
  });

  it('decide EmptyState and ListRow grouping in code', () => {
    // Both render a control and both used to assert `accessible` outright.
    for (const name of ['EmptyState.tsx', 'ListRow.tsx']) {
      const source = stripComments(readFileSync(join(componentsDir, name), 'utf8'));

      expect(source, `${name} must use groupAsOneElement`).toContain('groupAsOneElement');
    }
  });
});
