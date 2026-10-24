/**
 * Maintenance gate (v1.2, App.tsx launch gate). Shown instead of the app
 * when remote config has maintenance.enabled. Shows the team's honest
 * message (or a generic one when the config carries none), plus call /
 * WhatsApp buttons and a retry that re-fetches the config. Never traps
 * the user: contact actions are always available.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  whatsappAction,
} from '../lib/contact';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

export function MaintenanceScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors, fs } = useSettings();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          We’ll be back shortly
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          {message !== ''
            ? message
            : 'The app is under maintenance right now. Please try again in a little while.'}
        </Text>
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          You can still reach the team directly:
        </Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={callAction}>
          <Text style={styles.buttonText}>Call {CONTACT_PHONE_DISPLAY}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() => whatsappAction('Hi My Quick Trippers! The app shows maintenance mode. Can you help?')}>
          <Text style={styles.buttonText}>WhatsApp the team</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.outlineButton]} onPress={onRetry}>
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Try again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', padding: SPACING.xl },
  title: { fontWeight: WEIGHT.bold, textAlign: 'center' },
  text: { marginTop: SPACING.md, textAlign: 'center', lineHeight: 22 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  primaryButton: { backgroundColor: '#127C82' },
  whatsappButton: { backgroundColor: '#25D366' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
});
