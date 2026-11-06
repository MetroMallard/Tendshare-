import { isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing, type IconComponent } from '../primitives';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { groupAsOneElement } from './grouping';
import { listRowAccessibilityLabel } from './listRowLabel';
import { showsChevron } from './rowAffordance';
import { Text } from './Text';

export interface ListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  /**
   * Put the subtitle on its own full-width line under the title, instead of in
   * the column beside the trailing slot.
   *
   * Off by default, and right that way for a time, a count or a short state: two
   * short lines read faster together. On for a sentence that *is* the content —
   * a role's description, say — because in the column it has to share the width
   * with a badge and gets clamped mid-sentence, which reads as broken to the
   * person the sentence is for. With this on the subtitle is never clamped: it
   * wraps to as many lines as it needs, across the whole row.
   */
  readonly subtitleBelow?: boolean;
  /**
   * Replaces the spoken label.
   *
   * A row is one accessibility element, so by default it says the title and the
   * subtitle and nothing else. Use this when the row also *shows* something the
   * screen reader would otherwise miss — a badge carrying the role, for
   * instance — so the label says everything the row means.
   */
  readonly accessibilityLabel?: string;
  /** Leading glyph, shown in a tinted well. */
  readonly icon?: IconComponent;
  /** Leading initials, used when there is no `icon`. */
  readonly avatarName?: string;
  /**
   * Right-hand slot: a pill, a time, a value, a small action.
   *
   * A control here (a "Remove" button, say) is detected, and the row stops being
   * a single accessibility element so that control stays reachable by a screen
   * reader. See `grouping.ts`.
   */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** Spoken hint about what pressing does. Required reading for ambiguity. */
  readonly accessibilityHint?: string;
  /** Shown when a row leads somewhere. Defaults on when the row is pressable. */
  readonly showChevron?: boolean;
  /** Hairline above the row, for grouping rows into one card. */
  readonly divider?: boolean;
  readonly testID?: string;
}

/** A dependency-free chevron, drawn from the border colour token. */
function Chevron({ color }: { color: string }) {
  return (
    <View
      style={{
        borderColor: color,
        borderRightWidth: 2,
        borderTopWidth: 2,
        height: 9,
        transform: [{ rotate: '45deg' }],
        width: 9,
      }}
    />
  );
}

/**
 * Does this slot hold something a finger — or a screen reader — can activate?
 *
 * Walks the element tree rather than looking only at the top level, so a control
 * wrapped in a layout view is still found. Deliberately small: it knows the
 * design system's own `Button` and React Native's `Pressable`, which is every
 * way this row's trailing slot is used to carry an action.
 */
function holdsControl(node: ReactNode): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => holdsControl(child as ReactNode));
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return false;
  }

  if (node.type === Button || node.type === Pressable) {
    return true;
  }

  return holdsControl(node.props.children);
}

/**
 * The workhorse row: icon or avatar, a title, an optional second line and a
 * trailing slot.
 *
 * Rows are 60pt tall minimum, so a list of five is still easy to hit with a
 * thumb. A pressable row is one accessibility element — a screen reader says
 * the title and the subtitle together, not two fragments. A row that is *not*
 * pressable but carries a control in its trailing slot is not: grouping it
 * would hide the control, so its text and the control are read separately.
 *
 * Two layouts, one row: the subtitle beside the trailing slot (the default) and
 * the subtitle on its own full-width line beneath the title, for a subtitle that
 * is a sentence rather than a label. See `subtitleBelow`.
 *
 * A trailing badge never costs the chevron. The badge and the chevron share one
 * right-hand column: the badge is pinned, the chevron follows it, and the title
 * takes the rest of the width. An editable row looks editable whatever badge it
 * happens to carry.
 */
export function ListRow({
  title,
  subtitle,
  subtitleBelow = false,
  accessibilityLabel,
  icon: Icon,
  avatarName,
  trailing,
  onPress,
  accessibilityHint,
  showChevron,
  divider = false,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();

  const pressable = typeof onPress === 'function';
  const chevron = showsChevron({ pressable, showChevron, hasTrailing: trailing !== undefined });
  const spokenLabel = listRowAccessibilityLabel({
    title,
    subtitle,
    spokenLabel: accessibilityLabel,
  });
  const groupsAsOne = groupAsOneElement(holdsControl(trailing));

  const leading = Icon ? (
    <View
      accessible={false}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.brandSoft,
        borderRadius: theme.radius.field,
        height: theme.layout.controlHeight.small,
        justifyContent: 'center',
        width: theme.layout.controlHeight.small,
      }}
    >
      <Icon color={theme.colors.brand} size={22} strokeWidth={2} />
    </View>
  ) : avatarName ? (
    <Avatar name={avatarName} size="small" />
  ) : null;

  const titleText = (
    <Text variant="bodyStrong" numberOfLines={2}>
      {title}
    </Text>
  );

  const chevronSlot = chevron ? <Chevron color={theme.colors.textTertiary} /> : null;

  /**
   * The badge and the chevron are one column, not two siblings of the title.
   * When they were siblings with `marginLeft: 'auto'`, a long name and a wide
   * badge could not share a line and the badge wrapped onto its own, which made
   * that one row taller than its neighbours.
   */
  const rightColumn =
    trailing === undefined && chevronSlot === null ? null : (
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexShrink: 0,
          gap: theme.space.xs,
        }}
      >
        {trailing === undefined ? null : <View style={{ alignItems: 'flex-end' }}>{trailing}</View>}
        {chevronSlot}
      </View>
    );

  const body = subtitleBelow ? (
    <>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: theme.space.sm,
          minHeight: theme.layout.controlHeight.small,
        }}
      >
        {leading}
        <View style={{ flex: 1 }}>{titleText}</View>
        {rightColumn}
      </View>

      {/* Full width and unclamped: this is a sentence, not a label. */}
      {subtitle ? (
        <Text tone="secondary" variant="caption">
          {subtitle}
        </Text>
      ) : null}
    </>
  ) : (
    <>
      {leading}

      <View style={{ flex: 1, gap: theme.space['2xs'] }}>
        {titleText}
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightColumn}
    </>
  );

  const rowStyle = [
    subtitleBelow ? styles.rowStacked : styles.row,
    {
      borderTopColor: theme.colors.border,
      borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
      gap: subtitleBelow ? theme.space['2xs'] : theme.space.sm,
      minHeight: theme.layout.controlHeight.large,
      // 16pt, so a row sits in a `padding="none"` card at the same inset as the
      // cards around it. 8pt read as pinched.
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
    },
  ];

  if (!pressable) {
    return (
      <View
        accessible={groupsAsOne}
        accessibilityLabel={groupsAsOne ? spokenLabel : undefined}
        style={rowStyle}
        testID={testID}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      testID={testID}
      {...focusHandlers}
      style={({ pressed }) => [
        ...rowStyle,
        {
          backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
          borderRadius: theme.radius.field,
          opacity: pressed ? 0.9 : 1,
        },
        focusRingStyle,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rowStacked: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
});
