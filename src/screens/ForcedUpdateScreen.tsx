/**
 * Forced-update gate (v1.2, App.tsx launch gate). Shown instead of the
 * app when decideUpdatePrompt() returns 'forced'. HONEST LIMIT: the app
 * is NOT on Google Play yet, so NO download link is invented here.
 * Instead the user can WhatsApp the team a prefilled 'Send me the latest
 * app' message, call the team, or retry (which re-fetches config). The
 * user is never trapped without a contact route.
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

export function ForcedUpdateScreen({
  latestVersion,
  onRetry,
}: {
  latestVersion: string;
  onRetry: () => void;
}) {
  const { colors, fs } = useSettings();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Please update the app
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          This version is no longer supported
          {latestVersion !== '' ? ` (latest: ${latestVersion})` : ''}. The
          app is not on Google Play yet, so please ask the team for the
          latest version and they will share it with you.
        </Text>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() =>
            whatsappAction(
              `Hi My Quick Trippers! Please send me the latest app version${latestVersion !== '' ? ` (${latestVersion})` : ''}.`,
            )
          }>
          <Text style={styles.buttonText}>Send me the latest app (WhatsApp)</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={callAction}>
          <Text style={styles.buttonText}>Call {CONTACT_PHONE_DISPLAY}</Text>
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
