/**
 * Data & privacy (v1.2). Local data only: export produces a JSON summary
 * of on-device data (counts + traveler names, no secrets) via the Share
 * API; delete wipes every '@mqt/' AsyncStorage key behind a two-step
 * confirmation. HONEST LIMIT, stated on screen: already-sent enquiries
 * live in the team's Leads table and are NOT deleted by this screen —
 * removing them needs a request to the team (WhatsApp/call buttons).
 */
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callAction, whatsappAction } from '../lib/contact';
import {
  clearAllLocalData,
  localDataSummary,
} from '../lib/settings';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

export function DataPrivacyScreen() {
  const { colors, fs, t } = useSettings();
  const [status, setStatus] = useState<string | null>(null);

  async function handleExport() {
    setStatus(null);
    try {
      const summary = await localDataSummary();
      await Share.share({
        message: JSON.stringify(summary, null, 2),
        title: 'My Quick Trippers — local data export',
      });
    } catch {
      setStatus('Export could not be completed. Please try again.');
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete all local data?',
      'This removes your profile, travelers, saved trips, settings and caches from this device. Already-sent enquiries stay in the team’s Leads table.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Delete everything on this device',
          style: 'destructive',
          onPress: async () => {
            await clearAllLocalData();
            setStatus(
              'Local data deleted from this device. Already-sent enquiries still live in the team’s Leads table — contact the team to remove those.',
            );
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {t('dataPrivacy')}
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Your profile, travelers, saved trips and settings live only on
          this device. Nothing here is synced to an account.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Export my local data
        </Text>
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Shares a JSON summary of what this app stores on your device.
        </Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={handleExport}>
          <Text style={styles.buttonText}>Export local data (JSON)</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Delete my local data
        </Text>
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Clears your profile, travelers, saved trips, settings and caches
          from this device.
        </Text>
        <Pressable style={[styles.button, styles.dangerButton]} onPress={handleDelete}>
          <Text style={styles.buttonText}>Delete all local data</Text>
        </Pressable>
        {status !== null ? (
          <View style={[styles.statusBox, { backgroundColor: colors.estimatedBg }]}>
            <Text style={[styles.statusText, { color: colors.text, fontSize: fs(FONT.body) }]}>{status}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          About already-sent enquiries
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Enquiries you already sent live in the team’s Leads table, not
          on this device, so deleting local data does not remove them. To
          ask for their deletion, contact the team:
        </Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={callAction}>
          <Text style={styles.buttonText}>Call the team</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() =>
            whatsappAction(
              'Hi My Quick Trippers! Please delete my previously sent enquiries from your records.',
            )
          }>
          <Text style={styles.buttonText}>WhatsApp the team</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  text: { marginTop: SPACING.sm, lineHeight: 22 },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
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
  dangerButton: { backgroundColor: '#B00020' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  statusBox: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADII.card },
  statusText: { lineHeight: 22 },
});
