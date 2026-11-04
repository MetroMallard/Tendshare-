import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useReducedMotion } from '../primitives';

export type SkeletonShape = 'text' | 'row' | 'card';

export interface SkeletonProps {
  readonly shape?: SkeletonShape;
  /** Number of stacked lines for `text`, or rows for `row`. */
  readonly lines?: number;
  readonly width?: DimensionValue;
  readonly testID?: string;
}

/**
 * A loading placeholder with the shape of the thing that is coming.
 *
 * It pulses so the screen reads as "working", not as "broken", and it holds
 * still when the system asks for reduced motion. It is hidden from screen
 * readers: announcing a placeholder is noise, so the surrounding screen says
 * "Loading" once instead.
 */
export function Skeleton({ shape = 'text', lines = 1, width, testID }: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: theme.motion.slow * 3,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: theme.motion.slow * 3,
          toValue: 0.6,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse, reducedMotion, theme.motion.slow]);

  const bar = (height: number, key: string, barWidth: DimensionValue = '100%') => (
    <Animated.View
      key={key}
      style={{
        backgroundColor: theme.colors.surfaceSunken,
        borderRadius: theme.radius.field,
        height,
        opacity: pulse,
        width: barWidth,
      }}
    />
  );

  if (shape === 'card') {
    return (
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID}
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          gap: theme.space.sm,
          opacity: pulse,
          padding: theme.space.md,
          width: width ?? '100%',
        }}
      >
        {bar(theme.space.lg, 'title', '60%')}
        {bar(theme.typography.body.lineHeight, 'line-1')}
        {bar(theme.typography.body.lineHeight, 'line-2', '80%')}
      </Animated.View>
    );
  }

  if (shape === 'row') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID}
        style={{ gap: theme.space.sm, width: width ?? '100%' }}
      >
        {Array.from({ length: lines }, (_, index) => (
          <View
            key={`row-${String(index)}`}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.space.sm,
              minHeight: theme.layout.controlHeight.large,
            }}
          >
            <Animated.View
              style={{
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radius.pill,
                height: theme.layout.controlHeight.small,
                opacity: pulse,
                width: theme.layout.controlHeight.small,
              }}
            />
            <View style={{ flex: 1, gap: theme.space.xs }}>
              {bar(theme.typography.body.fontSize, `row-${String(index)}-title`, '55%')}
              {bar(theme.typography.caption.fontSize, `row-${String(index)}-sub`, '35%')}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={{ gap: theme.space.xs, width: width ?? '100%' }}
    >
      {Array.from({ length: lines }, (_, index) =>
        bar(
          theme.typography.body.lineHeight,
          `text-${String(index)}`,
          index === lines - 1 && lines > 1 ? '70%' : '100%',
        ),
      )}
    </View>
  );
}
