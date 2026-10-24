/**
 * Designed error state (v2 item 147). Friendly, specific, with retry +
 * support actions. Raw errors (stack traces, status codes, API bodies)
 * are never shown — the caller passes a user-safe message only.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { callAction, whatsappAction } from '../lib/contact';

interface Props {
  /** User-safe message, e.g. "Could not reach the server…". */
  message: string;
  /** Retry the failed action, when one exists. */
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again' }: Props) {
  const { colors, fs } = useSettings();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.errorBg }]}>
      <Ionicons name="alert-circle-outline" size={36} color={colors.errorText} />
      <Text style={[styles.message, { color: colors.errorText, fontSize: fs(15) }]}>
        {message}
      </Text>
      <View style={styles.row}>
        {onRetry !== undefined ? (
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={onRetry}
            accessibilityLabel={retryLabel}>
            <Text style={[styles.buttonText, { fontSize: fs(15) }]}>{retryLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.button, styles.supportButton, { borderColor: colors.primary }]}
          onPress={() =>
            void whatsappAction(
              'Hi My Quick Trippers! I ran into a problem in the app and need help.',
            )
          }
          accessibilityLabel="WhatsApp support">
          <Text style={[styles.supportText, { color: colors.primary, fontSize: fs(15) }]}>
            WhatsApp support
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.supportButton, { borderColor: colors.primary }]}
          onPress={() => void callAction()}
          accessibilityLabel="Call support">
          <Text style={[styles.supportText, { color: colors.primary, fontSize: fs(15) }]}>
            Call
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADII.card,
    padding: SPACING.lg,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportButton: {
    borderWidth: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: WEIGHT.bold,
  },
  supportText: {
    fontWeight: WEIGHT.bold,
  },
});
