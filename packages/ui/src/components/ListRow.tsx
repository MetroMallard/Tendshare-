import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing, type IconComponent } from '../primitives';
import { Avatar } from './Avatar';
import { listRowAccessibilityLabel } from './listRowLabel';
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
  /** Right-hand slot: a pill, a time, a value, a small action. */
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
 * The workhorse row: icon or avatar, a title, an optional second line and a
 * trailing slot.
 *
 * Rows are 60pt tall minimum, so a list of five is still easy to hit with a
 * thumb. A pressable row is one accessibility element — a screen reader says
 * the title and the subtitle together, not two fragments.
 *
 * Two layouts, one row: the subtitle beside the trailing slot (the default) and
 * the subtitle on its own full-width line beneath the title, for a subtitle that
 * is a sentence rather than a label. See `subtitleBelow`.
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
  const chevron = showChevron ?? pressable;
  const spokenLabel = listRowAccessibilityLabel({
    title,
    subtitle,
    spokenLabel: accessibilityLabel,
  });

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

  const trailingSlot = trailing ? <View style={{ alignItems: 'flex-end' }}>{trailing}</View> : null;
  const chevronSlot = chevron && !trailing ? <Chevron color={theme.colors.textTertiary} /> : null;

  const body = subtitleBelow ? (
    <>
      {/*
        `wrap` is deliberate: a long name beside a wide badge ("Visiting
        helper") leaves the name about 130pt on a 390pt phone, and a name broken
        across two lines reads worse than a badge that drops to its own line.
        The badge keeps the right edge wherever it lands.
      */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.space.sm,
          minHeight: theme.layout.controlHeight.small,
        }}
      >
        {leading}
        <View style={{ flexShrink: 1 }}>{titleText}</View>
        {trailing ? (
          <View style={{ alignItems: 'flex-end', marginLeft: 'auto' }}>{trailing}</View>
        ) : null}
        {chevronSlot}
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

      {trailingSlot}
      {chevronSlot}
    </>
  );

  const rowStyle = [
    subtitleBelow ? styles.rowStacked : styles.row,
    {
      borderTopColor: theme.colors.border,
      borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
      gap: subtitleBelow ? theme.space['2xs'] : theme.space.sm,
      minHeight: theme.layout.controlHeight.large,
      paddingVertical: theme.space.xs,
      paddingHorizontal: theme.space.xs,
    },
  ];

  if (!pressable) {
    return (
      <View accessible accessibilityLabel={spokenLabel} style={rowStyle} testID={testID}>
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
