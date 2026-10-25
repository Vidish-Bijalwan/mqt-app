import React, { useCallback, useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { callAction, whatsappAction } from '../lib/contact';
import { listTrips } from '../lib/trips';
import type { SavedTrip } from '../lib/trips';
import { listPlannerTrips, TRIP_TYPE_LABELS } from '../lib/planner';
import type { PlannedTrip } from '../lib/planner';
import { recordViewed } from '../lib/recentHistory';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import type { Palette } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Trips'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Trips tab (v1.1, item 1). Device-local recent enquiries only — an entry
 * appears here only after a real enquiry submission returns a reference.
 * Nothing is invented: no bookings, payments or trips are shown that the
 * user did not actually enquire about in this app.
 */
export function TripsScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [plannerTrips, setPlannerTrips] = useState<PlannedTrip[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listTrips().then((t) => {
        if (alive) setTrips(t);
      });
      listPlannerTrips().then((t) => {
        if (alive) setPlannerTrips(t);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  // v2 planner routes ('Planner' / 'TripDetail') are registered by the
  // coordinator (see qa/v2-routes-planner.md); cast here so this tab
  // can navigate to them without editing navigation/types.ts.
  const goPlanner = () =>
    (navigation.navigate as unknown as (r: string, p?: object) => void)(
      'Planner',
      {},
    );
  const goTripDetail = (params: {
    kind: 'saved' | 'planner';
    ref?: string;
    plannerId?: string;
    slug: string;
    packageName: string;
    travelDate?: string;
  }) =>
    (navigation.navigate as unknown as (r: string, p?: object) => void)(
      'TripDetail',
      params,
    );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>My Trips</Text>
        {/* v2: planner entry from the Trips tab (items 81–90). */}
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={goPlanner}>
          <Text style={styles.buttonText}>Trip planner</Text>
        </Pressable>
        <Text style={styles.note}>
          Plan named trips, estimate budgets and run the itinerary quiz
          in the planner. Plans stay on this device.
        </Text>
        {plannerTrips.length > 0 ? (
          <View style={styles.list}>
            {plannerTrips.map((plan) => (
              <View key={plan.id} style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {plan.name}
                </Text>
                <Text style={styles.cardMeta}>
                  Trip plan · {TRIP_TYPE_LABELS[plan.type]} ·{' '}
                  {plan.packageSlugs.length} package
                  {plan.packageSlugs.length === 1 ? '' : 's'}
                </Text>
                <View style={styles.cardActions}>
                  <Pressable
                    style={[styles.smallButton, styles.outlineSmall]}
                    onPress={() => goPlanner()}>
                    <Text style={styles.smallButtonText}>Open in planner</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.primarySmall]}
                    onPress={() =>
                      goTripDetail({
                        kind: 'planner',
                        plannerId: plan.id,
                        slug: plan.packageSlugs[0] ?? '',
                        packageName: plan.name,
                        travelDate:
                          plan.travelDate !== '' ? plan.travelDate : undefined,
                      })
                    }>
                    <Text style={styles.smallButtonTextWhite}>Trip details</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {trips.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Trips you enquire about will appear here.
            </Text>
            <Text style={styles.emptySub}>
              Send an enquiry for any package and it will be saved on this
              device so you can find it again.
            </Text>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigation.navigate('Packages')}>
              <Text style={styles.buttonText}>Browse packages</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {trips.map((trip) => (
              <View key={trip.ref} style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {trip.packageName}
                </Text>
                <Text style={styles.cardMeta}>Enquiry ref: {trip.ref}</Text>
                <Text style={styles.cardMeta}>
                  Enquired{' '}
                  {new Date(trip.date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                {trip.travelDate !== undefined && trip.travelDate !== '' ? (
                  <Text style={styles.cardMeta}>
                    Preferred travel date: {trip.travelDate}
                  </Text>
                ) : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={[styles.smallButton, styles.primarySmall]}
                    onPress={() =>
                      goTripDetail({
                        kind: 'saved',
                        ref: trip.ref,
                        slug: trip.slug,
                        packageName: trip.packageName,
                        travelDate: trip.travelDate,
                      })
                    }>
                    <Text style={styles.smallButtonTextWhite}>Trip details</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.outlineSmall]}
                    onPress={() =>
                      navigation.navigate('TripKit', { ref: trip.ref })
                    }>
                    <Text style={styles.smallButtonText}>Trip kit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.outlineSmall]}
                    onPress={() => {
                      void recordViewed(trip.slug);
                      navigation.navigate('PackageDetail', { slug: trip.slug });
                    }}>
                    <Text style={styles.smallButtonText}>View package</Text>
                  </Pressable>
                  {/* v1.3 item 50: team-routed requests via WhatsApp —
                   * not instant changes. Message carries ref + package. */}
                  <Pressable
                    style={[styles.smallButton, styles.outlineSmall]}
                    onPress={() =>
                      whatsappAction(
                        `Hi My Quick Trippers! I would like to request a change to my trip enquiry (ref: ${trip.ref}) for "${trip.packageName}". Please contact me about this change.`,
                      )
                    }>
                    <Text style={styles.smallButtonText}>Request change</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.outlineSmall]}
                    onPress={() =>
                      whatsappAction(
                        `Hi My Quick Trippers! I would like to request cancellation of my trip enquiry (ref: ${trip.ref}) for "${trip.packageName}". Please contact me about this cancellation.`,
                      )
                    }>
                    <Text style={styles.smallButtonText}>
                      Request cancellation
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.primarySmall]}
                    onPress={() =>
                      navigation.navigate('Tabs', {
                        screen: 'Chat',
                        params: {
                          slug: trip.slug,
                          packageName: trip.packageName,
                          ref: trip.ref,
                        },
                      })
                    }>
                    <Text style={styles.smallButtonTextWhite}>
                      Chat about this trip
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Need help with a trip?</Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={callAction}>
          <Text style={styles.buttonText}>Call the team</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() =>
            whatsappAction(
              'Hi My Quick Trippers! I have a question about my trip enquiry.',
            )
          }>
          <Text style={styles.buttonText}>WhatsApp the team</Text>
        </Pressable>
        <Text style={styles.note}>
          Calling or WhatsApp opens your phone app — nothing is sent from
          inside this screen without you confirming it there.
        </Text>
        <Text style={styles.note}>
          Saved trips live only on this device for now. Account sync arrives
          with sign-in, which is not connected yet.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: {
    fontSize: FONT.title,
    fontWeight: WEIGHT.bold,
    color: c.text,
  },
  empty: { marginTop: SPACING.xl },
  emptyText: { fontSize: FONT.heading, fontWeight: WEIGHT.bold, color: c.text },
  emptySub: {
    fontSize: FONT.body,
    color: c.muted,
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  list: { marginTop: SPACING.lg, gap: SPACING.md },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: RADII.card,
    padding: SPACING.lg,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: FONT.heading,
    fontWeight: WEIGHT.bold,
    color: c.text,
  },
  cardMeta: { fontSize: FONT.meta, color: c.muted, marginTop: SPACING.xs },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  smallButton: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.sm,
  },
  outlineSmall: { borderColor: c.primary },
  primarySmall: { backgroundColor: c.primary, borderColor: c.primary },
  smallButtonText: { fontSize: FONT.body, fontWeight: WEIGHT.bold, color: c.primary },
  smallButtonTextWhite: { fontSize: FONT.body, fontWeight: WEIGHT.bold, color: c.white },
  sectionTitle: {
    fontSize: FONT.heading,
    fontWeight: WEIGHT.bold,
    color: c.text,
    marginTop: SPACING.xl,
  },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  primaryButton: { backgroundColor: c.primary },
  whatsappButton: { backgroundColor: '#25D366' },
  buttonText: { color: c.white, fontSize: 16, fontWeight: WEIGHT.bold },
  note: {
    fontSize: FONT.meta,
    color: c.muted,
    marginTop: SPACING.md,
    lineHeight: 18,
  },
  });
}
