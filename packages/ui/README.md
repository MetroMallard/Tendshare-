# @tendshare/ui — reserved

**Nothing is implemented here yet, on purpose.** This folder is a placeholder so the
next slice of Phase 1 (the design system) has a home and nobody has to move files
around later.

## Who owns it

The design-system slice owns everything inside this folder: the brand tokens (colour,
spacing, type scale, radii, shadows) with full light and dark mode, and the core
component library (buttons, cards, inputs, list rows, badges, modals, empty states,
skeleton loaders).

## The seam, as it stands today

The app shell in `apps/app` currently reads its colours, spacing, radii and type
sizes from **`apps/app/src/theme/tokens.ts`** — a small, deliberately neutral stand-in
marked with a `TODO(design-system)`. There is exactly one thing the app depends on:

- `ThemeProvider` + `useTheme()` from `apps/app/src/theme`, where `useTheme()` returns
  a theme with `colors`, `spacing`, `radius`, `typography` and `layout` keys.

When this package lands, the intended move is: `apps/app` imports the provider and
tokens from `@tendshare/ui`, and `apps/app/src/theme/tokens.ts` is deleted. Nothing
else in the shell should need to change — the tab bar, `Screen` and the placeholder
components all read colours through `useTheme()`.

## Ground rules for this package

- React Native + react-native-web compatible primitives only; no DOM-only components.
- WCAG AA contrast, 48px tap targets, 17px+ body text, dynamic type.
- No medical copy, no health claims, and nothing that reads like advice.
- No analytics or tracking inside components.
