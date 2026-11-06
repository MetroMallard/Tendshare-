/**
 * The shared notice block, for the rest of the app.
 *
 * `OnboardingNotice` was written in Task 5 and is exactly the shape every other
 * screen needs: one calm sentence block, tinted from the theme, marked by a
 * leading word as well as a colour. Rather than a second copy with its own
 * palette, this re-exports it under a name that does not belong to onboarding.
 * If a third caller appears, the file moves; until then an alias is the honest
 * amount of structure.
 */
export {
  OnboardingNotice as Notice,
  type NoticeTone,
  type OnboardingNoticeProps as NoticeProps,
} from '../onboarding/components/OnboardingNotice';
