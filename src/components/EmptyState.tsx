/**
 * Designed empty state (v2 item 146). Every screen owns one: a line of
 * honest copy plus ONE action — never a blank screen, never a fake
 * count or placeholder item.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

interface Props {
  /** Ionicons glyph name. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const { colors, fs } = useSettings();
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={44} color={colors.muted} />
      <Text style={[styles.title, { color: colors.text, fontSize: fs(17) }]}>
        {title}
      </Text>
      <Text style={[styles.message, { color: colors.muted, fontSize: fs(15) }]}>
        {message}
      </Text>
      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onAction}
        accessibilityLabel={actionLabel}>
        <Text style={[styles.buttonText, { fontSize: fs(16) }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  title: {
    fontWeight: WEIGHT.bold,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: WEIGHT.bold,
  },
});
