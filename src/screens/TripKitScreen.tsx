/**
 * Downloadable trip kit (v2, item 153).
 *
 * Params: { ref: string } — the enquiry reference of a real saved trip.
 * The kit is cached device-local and viewable offline: itinerary
 * summary from the real trip record + catalogue entry (verbatim
 * duration/route/description, or an honest "ask the team" note),
 * the team's real contact, and share-as-text. PDF export is DEFERRED:
 * no PDF library is installed in this app, so no PDF is generated or
 * promised here.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import {
  buildTripKitForRef,
  loadTripKit,
  tripKitShareText,
} from '../lib/offline';
import type { TripKit } from '../lib/offline';
import { callAction } from '../lib/contact';

type RouteParams = { ref?: string };

export function TripKitScreen() {
  const route = useRoute() as unknown as { params?: RouteParams };
  const ref = route.params?.ref ?? '';
  const { colors, fs } = useSettings();
  const [kit, setKit] = useState<TripKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    if (ref === '') {
      void Promise.resolve().then(() => {
        if (alive) {
          setLoading(false);
          setNotFound(true);
        }
      });
      return () => {
        alive = false;
      };
    }
    void (async () => {
      const cached = await loadTripKit(ref);
      if (!alive) return;
      if (cached !== null) {
        setKit(cached);
        setLoading(false);
        return;
      }
      const built = await buildTripKitForRef(ref);
      if (!alive) return;
      setKit(built);
      setNotFound(built === null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [ref]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Loading trip kit…
        </Text>
      </View>
    );
  }

  if (notFound || kit === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Trip kit not found
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          No saved trip matches this reference. Trip kits are created
          from your My Trips entries.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {kit.packageName}
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Booking ref: {kit.ref}
          {kit.travelDate !== undefined ? ` · Travel date: ${kit.travelDate}` : ''}
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Saved on this device — viewable offline. PDF export is not
          available yet (no PDF library installed); share as text below.
        </Text>

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Itinerary summary
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          {kit.itinerarySummary}
        </Text>

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Contacts
        </Text>
        {kit.contacts.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.button, styles.primaryButton]}
            onPress={callAction}>
            <Text style={styles.buttonText}>
              {c.label}: {c.value}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={[styles.button, styles.outlineButton]}
          onPress={() => {
            void Share.share({ message: tripKitShareText(kit) });
          }}>
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
            Share trip kit as text
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  title: { fontWeight: WEIGHT.bold },
  heading: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  note: { marginTop: SPACING.sm, lineHeight: 22 },
  text: { marginTop: SPACING.sm, lineHeight: 24 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
  },
  primaryButton: { backgroundColor: '#127C82' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
});
