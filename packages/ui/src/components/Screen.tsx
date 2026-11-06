import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { EdgeInsets } from '../primitives';

export interface ScreenProps {
  readonly children: ReactNode;
  /** Real safe-area insets, passed in by the app. */
  readonly insets?: EdgeInsets;
  /** Turn off for a screen that scrolls its own content. */
  readonly scroll?: boolean;
  /** Pinned under the content and above the tab bar. */
  readonly footer?: ReactNode;
  /**
   * Keep the content and the footer clear of the on-screen keyboard.
   *
   * On for every screen with an input. iOS shrinks the frame by the keyboard
   * height so the pinned footer rises with it and the focused field is scrolled
   * into view; Android resizes the window itself (`adjustResize`), so the frame
   * is already correct and this is inert there. Web has no keyboard inset.
   */
  readonly keyboardAware?: boolean;
  readonly testID?: string;
}

/**
 * The frame every screen sits in.
 *
 * Phone: full width, 20pt gutters. Tablet and desktop browser: a centred column
 * so a line of body text never sprawls across a wide window. Safe-area insets
 * keep the first and last line clear of the notch and the home indicator, and
 * the background is the warm `bg` token rather than whatever a screen felt like.
 */
export function Screen({
  children,
  insets,
  scroll = true,
  footer,
  keyboardAware,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const gutter =
    width >= theme.layout.breakpoints.desktop
      ? theme.layout.gutter.desktop
      : width >= theme.layout.breakpoints.tablet
        ? theme.layout.gutter.tablet
        : theme.layout.gutter.phone;

  const paddingTop = (insets?.top ?? 0) + theme.space.md;
  const paddingBottom = (insets?.bottom ?? 0) + theme.space.lg;

  const column = { maxWidth: theme.layout.maxContentWidth, width: '100%' } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={keyboardAware === true && Platform.OS === 'ios'}
      style={{ backgroundColor: theme.colors.bg, flex: 1 }}
      testID={testID}
    >
      {scroll ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets={keyboardAware === true && Platform.OS === 'ios'}
          contentContainerStyle={{
            alignItems: 'center',
            flexGrow: 1,
            paddingBottom,
            paddingHorizontal: gutter,
            paddingTop,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={column}>{children}</View>
        </ScrollView>
      ) : (
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            paddingBottom,
            paddingHorizontal: gutter,
            paddingTop,
          }}
        >
          <View style={[column, { flex: 1 }]}>{children}</View>
        </View>
      )}

      {footer ? (
        <View
          style={{
            backgroundColor: theme.colors.bg,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            paddingBottom: insets?.bottom ?? 0,
            paddingHorizontal: gutter,
            paddingTop: theme.space.sm,
          }}
        >
          <View style={[column, { alignSelf: 'center' }]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
