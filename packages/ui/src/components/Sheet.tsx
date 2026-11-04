import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { EdgeInsets } from '../primitives';
import { Button } from './Button';
import { Text } from './Text';

export interface SheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  /** Actions at the bottom. A sheet with no footer still has the close button. */
  readonly footer?: ReactNode;
  readonly insets?: EdgeInsets;
  readonly testID?: string;
}

/**
 * A bottom sheet.
 *
 * Rises from the bottom edge on a phone and centres on a wide screen, with a
 * scrim that closes it. The title is the accessible name of the dialog, and
 * closing is always available — either the scrim, the hardware back button, or
 * the explicit Close button.
 */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  insets,
  testID,
}: SheetProps) {
  const theme = useTheme();
  const bottom = insets?.bottom ?? 0;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={{
            backgroundColor: theme.colors.overlay,
            bottom: 0,
            left: 0,
            opacity: 0.45,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />

        <View
          accessibilityLabel={title}
          accessibilityViewIsModal
          testID={testID}
          style={[
            {
              alignSelf: 'center',
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
              borderTopLeftRadius: theme.radius.panel,
              borderTopRightRadius: theme.radius.panel,
              borderWidth: 1,
              gap: theme.space.sm,
              maxWidth: theme.layout.sheetMaxWidth,
              paddingBottom: theme.space.md + bottom,
              paddingHorizontal: theme.space.md,
              paddingTop: theme.space.md,
              width: '100%',
            },
            theme.elevation.raised,
          ]}
        >
          <View
            accessible={false}
            style={{
              alignSelf: 'center',
              backgroundColor: theme.colors.borderStrong,
              borderRadius: theme.radius.pill,
              height: 4,
              marginBottom: theme.space['2xs'],
              width: theme.space.xl,
            }}
          />

          <Text accessibilityRole="header" variant="heading">
            {title}
          </Text>

          {description ? (
            <Text tone="secondary" variant="body">
              {description}
            </Text>
          ) : null}

          {children}

          <View style={{ gap: theme.space.xs, marginTop: theme.space['2xs'] }}>
            {footer ?? <Button label="Close" onPress={onClose} variant="secondary" fullWidth />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export interface ConfirmSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly message: string;
  /** Name the thing, not the mechanic: "Delete this document". */
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** Turning this on paints the confirm button with the danger token. */
  readonly destructive?: boolean;
  readonly loading?: boolean;
  readonly testID?: string;
}

/**
 * The destructive-confirm variant: a sheet that asks before something is lost.
 *
 * The safe choice is the wide secondary button; the destructive one is labelled
 * with the consequence. Both are 48pt, so neither is easier to hit by accident.
 */
export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
  destructive = false,
  loading = false,
  testID,
}: ConfirmSheetProps) {
  return (
    <Sheet
      description={message}
      footer={
        <>
          <Button
            label={confirmLabel}
            loading={loading}
            onPress={onConfirm}
            variant={destructive ? 'destructive' : 'primary'}
            fullWidth
          />
          <Button
            label={cancelLabel}
            onPress={onClose}
            variant="secondary"
            fullWidth
            disabled={loading}
          />
        </>
      }
      onClose={onClose}
      testID={testID}
      title={title}
      visible={visible}
    />
  );
}
