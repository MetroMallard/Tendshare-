import { useId, type ReactNode } from 'react';
import { Platform, TextInput as RNTextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing } from '../primitives';
import { Text } from './Text';

export interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  /** Replaces the hint while it is set, and marks the field invalid. */
  readonly error?: string;
  readonly optional?: boolean;
  /** Anything with an input in it: a `TextInput`, a `SegmentedControl`, a picker. */
  readonly children: ReactNode;
  readonly testID?: string;
}

/**
 * The label, hint and inline error that surround any input.
 *
 * One component owns the accessibility wiring so no screen has to remember it:
 * the label is the accessible name, the hint or error is the accessible hint,
 * and an error is announced as invalid rather than only turning the border red.
 */
export function Field({ label, hint, error, optional, children, testID }: FieldProps) {
  const theme = useTheme();
  const labelId = useId();
  const supportId = useId();
  const support = error ?? hint;

  return (
    <View testID={testID} style={{ gap: theme.space.xs }}>
      <View style={{ flexDirection: 'row', gap: theme.space['2xs'] }}>
        <Text variant="label" nativeID={labelId} style={{ flexShrink: 1 }}>
          {label}
        </Text>
        {optional ? (
          <Text variant="label" tone="tertiary">
            Optional
          </Text>
        ) : null}
      </View>

      {children}

      {support ? (
        <View
          nativeID={supportId}
          accessible
          accessibilityLabel={support}
          style={{ alignItems: 'flex-start', flexDirection: 'row', gap: theme.space['2xs'] }}
        >
          {error ? (
            <Text variant="caption" tone="danger" style={{ fontWeight: '700' }}>
              !
            </Text>
          ) : null}
          <Text variant="caption" tone={error ? 'danger' : 'secondary'} style={{ flexShrink: 1 }}>
            {support}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly optional?: boolean;
  readonly testID?: string;
}

/**
 * A labeled text input at 17pt, with 16pt of padding and a visible focus ring.
 * Typed text is `textPrimary` on `surface` in both schemes.
 */
export function TextField({
  label,
  hint,
  error,
  optional,
  testID,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();
  const hasError = typeof error === 'string' && error.length > 0;

  return (
    <Field error={error} hint={hint} label={label} optional={optional} testID={testID}>
      <RNTextInput
        {...rest}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled: rest.editable === false }}
        aria-invalid={hasError}
        placeholderTextColor={theme.colors.textTertiary}
        onFocus={(event) => {
          focusHandlers.onFocus();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          focusHandlers.onBlur();
          onBlur?.(event);
        }}
        style={[
          theme.typography.body,
          Platform.OS === 'web' ? { fontFamily: theme.fontFamily.web } : null,
          {
            backgroundColor: theme.colors.surface,
            borderColor: hasError ? theme.colors.danger : theme.colors.borderStrong,
            borderRadius: theme.radius.field,
            borderWidth: hasError ? 2 : 1,
            color: theme.colors.textPrimary,
            minHeight: theme.layout.controlHeight.medium,
            paddingHorizontal: theme.space.sm,
            paddingVertical: theme.space.xs,
          },
          focusRingStyle,
        ]}
      />
    </Field>
  );
}
