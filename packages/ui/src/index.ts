/**
 * @tendshare/ui — the Tendshare design system.
 *
 * Everything visual in the product comes from here: one theme object with the
 * brand tokens, and a small set of components built only from those tokens. If a
 * screen needs something that is not in this barrel, it is added here first — no
 * screen ever holds a hex value, a font size or a magic padding.
 */

// Theme: tokens + provider.
export * from './tokens';
export * from './ThemeProvider';
export * from './primitives';
export * from './types';

// Primitives and components.
export * from './components/Avatar';
export * from './components/Badge';
export * from './components/Button';
export * from './components/Card';
export * from './components/EmptyState';
export * from './components/Field';
export * from './components/ListRow';
export * from './components/Screen';
export * from './components/ScreenHeader';
export * from './components/Section';
export * from './components/SegmentedControl';
export * from './components/Sheet';
export * from './components/Skeleton';
export * from './components/Switch';
export * from './components/TabBar';
export * from './components/Text';
