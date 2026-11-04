# Changelog

All notable changes to Tendshare are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The monorepo.** A Turborepo + pnpm workspace with one app (`apps/app`) and one
  shared configuration package (`packages/config`). `packages/ui` and
  `packages/types` are reserved folders with a README each and no code, so the
  design system and the shared domain types have an obvious home.
- **The app shell.** An Expo + Expo Router app that runs on iOS, Android and the web
  through react-native-web, with the five tabs the product needs — **Today,
  Calendar, Meds, Money, More** — in that order. Each tab shows a clearly marked
  placeholder card; no feature logic has been written yet.
- **A tab bar built for this audience.** Lucide icons (one consistent set), labels
  always visible under the icons, a soft pill marking the active tab so selection
  does not rely on colour alone, 48pt minimum tap targets, and a bar that stays
  aligned with the content column on a wide browser window.
- **A responsive shell.** Phone, tablet and desktop browser layouts from one
  component: 20pt gutters on a phone, a centred 720pt content column above tablet
  width, and safe-area insets respected on every screen.
- **Light and dark mode that follows the system setting**, with a small local token
  file as a stand-in until the design system package lands. Body text is 17px and
  every text/background pairing meets WCAG AA (there is a test that asserts it).
- **An error boundary** in the root layout: if a screen throws, the family sees calm
  copy and a retry button instead of a stack trace.
- **Shared configuration.** One strict tsconfig, one ESLint flat config (with
  `no-explicit-any` as an error) and one Prettier config, extended by every
  workspace.
- **Tests.** Vitest runs from the repository root. The smoke tests assert the tab
  contract (exactly five tabs, in order, each with a real screen file and a spoken
  label) and the design token contract (every colour defined, every text pairing at
  WCAG AA, body text 17px or larger, tap targets 48pt or larger).
- **CI.** GitHub Actions installs with pnpm (with caching) and runs typecheck, lint
  and test on every pull request and every push to `main`.
- **Documentation.** A README with exact run steps, prerequisites and the iOS/Android
  caveat, plus `PROJECT_BRIEF.md` as the build contract.

### Notes

- Nothing in this release touches health data: there is no Supabase, no auth, no
  network call and no analytics or tracking SDK yet.
- iOS and Android store builds need the owner's own EAS account and cannot be
  produced on this machine.
