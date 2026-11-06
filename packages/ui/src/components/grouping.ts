/**
 * When a container may present itself as one accessibility element.
 *
 * A view marked `accessible` on iOS and Android (and `role="group"`-ish on web)
 * *swallows its children*: a screen reader stops on the container, reads its
 * label and never reaches anything inside. That is exactly right for a block of
 * decorative text — one sentence read as one sentence instead of three
 * fragments — and exactly wrong the moment the block holds a button, because the
 * button becomes unreachable by VoiceOver and TalkBack while still being
 * visible and tappable by everyone else.
 *
 * So the rule lives in one place and is unit-tested: a container with an
 * interactive child is never `accessible`; the container's own text stays
 * individually focusable and the control keeps its own label.
 */
export function groupAsOneElement(hasInteractiveChild: boolean): boolean {
  return !hasInteractiveChild;
}
