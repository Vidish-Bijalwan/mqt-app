import React, { useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, DURATIONS, FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  enquiryMessage,
  whatsappAction,
} from '../lib/contact';
import { packageImageUrl } from '../data/packages';
import { useCatalog } from '../lib/catalog';
import { useSettings } from '../context/SettingsContext';
import { getPriceInfo } from '../lib/price';
import { getSearchPrice } from '../lib/search';
import { recordPriceSnapshot } from '../lib/priceHistory';
import { recordViewed } from '../lib/recentHistory';
import { getPackageNote, setPackageNote } from '../lib/notes';
import type { RootStackParamList } from '../navigation/types';
import { PackageGallery } from '../components/PackageGallery';
import { PriceBlock } from '../components/PriceBlock';
import {
  packageSiteUrl,
  routeStops,
  similarPackages,
} from '../lib/booking';

type Props = NativeStackScreenProps<RootStackParamList, 'PackageDetail'>;

/**
 * Package detail (v1.3, items 31–40). Only real data is shown:
 * - Gallery: the one real photo, captioned with the package title,
 *   with the honest "1 photo" indicator from PackageGallery. The
 *   photos-array structure already supports swipe and future photos;
 *   no photo is invented and no zoom library is added.
 * - Itinerary: NO day/meal/stay data exists, so the route string is
 *   shown as a "Route stops" timeline — stops, NOT days. Full
 *   day-wise itinerary is DEFERRED (no data source).
 * - Price: breakdown from getPriceInfo() only, labeled "as listed";
 *   taxes/inclusions unknown, confirmed by the team on callback.
 * - Availability, inclusions/exclusions, hotels, reviews: honest
 *   "not available / confirmed by the team" blocks — nothing derived
 *   from route text, no invented names, ratings or photos.
 * - Similar packages: same category first, then price-band proximity;
 *   unpriced packages render "Price on enquiry", never a fake price.
 * - Share: system Share with title + price when priced + the verified
 *   site link https://www.myquicktrippers.com/packages/<slug>
 *   (verified 2026-10-25 from the live sitemap; bundled slugs match).
 */
export function PackageDetailScreen({ route, navigation }: Props) {
  const catalog = useCatalog();
  const { colors } = useSettings();
  const [photoAnim] = useState(() => new Animated.Value(0));
  const [shareNote, setShareNote] = useState<string | null>(null);
  // v2 item 87: personal note for this package, device-local.
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    Animated.timing(photoAnim, {
      toValue: 1,
      duration: DURATIONS.normal,
      useNativeDriver: true,
    }).start();
  }, [photoAnim]);

  // v2 items 84/88: record the displayed price + the view itself so
  // price history and recently-viewed cover detail views too (not
  // just planner/trip screens). Best-effort, never blocks rendering.
  useEffect(() => {
    const found = catalog.packages.find((p) => p.slug === route.params.slug);
    if (!found) return;
    void recordPriceSnapshot(found.slug, getSearchPrice(found).display);
    void recordViewed(found.slug);
  }, [catalog.packages, route.params.slug]);

  // v2 item 87: load the saved note for this package.
  useEffect(() => {
    let alive = true;
    getPackageNote(route.params.slug).then((value) => {
      if (alive) setNote(value);
    });
    return () => {
      alive = false;
    };
  }, [route.params.slug]);

  const pkg = catalog.packages.find((p) => p.slug === route.params.slug);

  if (!pkg) {
    return (
      <SafeAreaView style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={styles.notFoundText}>
          Sorry, this package could not be found.
        </Text>
      </SafeAreaView>
    );
  }

  const price = getPriceInfo(pkg);
  const stops = routeStops(pkg.route);
  const similar = similarPackages(catalog.packages, pkg);
  const photoOpacity = photoAnim;
  const photoScale = photoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  async function handleShare(): Promise<void> {
    if (pkg === undefined) return;
    const lines = [`${pkg.title} — My Quick Trippers`];
    if (price.hasPrice) lines.push(`Price as listed: ${price.display}`);
    lines.push(packageSiteUrl(pkg.slug));
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      setShareNote('Sharing is not available on this device right now.');
    }
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}>
      <ScrollView style={styles.scroll}>
        <Animated.View
          style={{ opacity: photoOpacity, transform: [{ scale: photoScale }] }}>
          <PackageGallery photos={[packageImageUrl(pkg)]} height={260} />
        </Animated.View>
        <View style={styles.body}>
          <Text style={styles.caption}>{pkg.title}</Text>
          <Text style={styles.title}>{pkg.title}</Text>
          <Text style={styles.meta}>
            {pkg.category}
            {pkg.duration ? `  ·  ${pkg.duration}` : ''}
          </Text>

          <PriceBlock price={price} />
          <Text style={styles.priceNote}>
            Prices as listed on myquicktrippers.com; final quote is confirmed
            on enquiry.
          </Text>

          <Text style={styles.sectionHeading}>Price breakdown</Text>
          {price.hasPrice ? (
            <View>
              <Text style={styles.sectionText}>
                Listed price: {price.display}
              </Text>
              {price.crossed !== '' ? (
                <Text style={styles.sectionText}>
                  Listed MRP: {price.crossed}
                </Text>
              ) : null}
              {price.save !== '' ? (
                <Text style={styles.sectionText}>
                  You save (as listed): {price.save}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.sectionText}>Pricing on request.</Text>
          )}
          <Text style={styles.sectionText}>
            Taxes and inclusions are not published for this package — they
            are confirmed by the team on callback. Whether the listed price
            is per person or for the whole trip is not stated in the price
            data, so it is shown only as listed; the final quote is
            confirmed on enquiry.
          </Text>

          {stops.length > 0 ? (
            <View>
              <Text style={styles.sectionHeading}>Route stops</Text>
              <Text style={styles.note}>
                These are route stops from the package route — not a
                day-wise itinerary. Day-by-day details, meals and stays are
                not published for this package and are confirmed by the
                team on callback.
              </Text>
              {stops.map((stop, i) => (
                <View key={`${stop}-${i}`} style={styles.stopRow}>
                  <Text style={styles.stopNumber}>{i + 1}</Text>
                  <Text style={styles.stopText}>{stop}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {pkg.description !== '' ? (
            <>
              <Text style={styles.sectionHeading}>About this trip</Text>
              <Text style={styles.sectionText}>{pkg.description}</Text>
            </>
          ) : null}

          <Text style={styles.sectionHeading}>Departure dates & availability</Text>
          <Text style={styles.sectionText}>
            Departure dates and seat availability are confirmed by the team
            on callback. A live availability calendar is not available yet
            — no dates or seat counts are published for this package.
          </Text>

          <Text style={styles.sectionHeading}>What is included</Text>
          <Text style={styles.sectionText}>
            Inclusions, exclusions, hotel, cab, meals and permits are
            confirmed per package by the team — they are not published in
            structured form for this package, so no checklist is guessed
            here. You can ask for specific inclusions as requests in the
            booking request flow.
          </Text>

          <Text style={styles.sectionHeading}>Hotels</Text>
          <Text style={styles.sectionText}>
            Hotel names are shared on booking confirmation. No hotel names,
            ratings or photos are listed here because none are confirmed
            for this package.
          </Text>

          <Text style={styles.sectionHeading}>Traveller reviews</Text>
          <Text style={styles.sectionText}>
            Traveller reviews for this package are not available in the app
            yet. No reviews are shown because there is no verified review
            source for this package.
          </Text>

          {similar.length > 0 ? (
            <View>
              <Text style={styles.sectionHeading}>Similar packages</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.similarRow}>
                  {similar.map((s) => {
                    const sp = getPriceInfo(s);
                    return (
                      <Pressable
                        key={s.slug}
                        style={styles.similarCard}
                        onPress={() =>
                          navigation.push('PackageDetail', { slug: s.slug })
                        }>
                        <Text style={styles.similarTitle} numberOfLines={2}>
                          {s.title}
                        </Text>
                        <Text style={styles.similarMeta}>{s.category}</Text>
                        <Text style={styles.similarPrice}>
                          {sp.hasPrice ? sp.display : 'Price on enquiry'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() =>
                navigation.navigate('Booking', {
                  slug: pkg.slug,
                  packageName: pkg.title,
                })
              }>
              <Text style={styles.primaryButtonText}>
                Start booking request
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() =>
                navigation.navigate('Enquiry', {
                  slug: pkg.slug,
                  packageName: pkg.title,
                })
              }>
              <Text style={styles.primaryButtonText}>Enquire</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() =>
                navigation.navigate('Pay', {
                  slug: pkg.slug,
                  packageName: pkg.title,
                  amount: price.hasPrice ? price.deal : 0,
                })
              }>
              <Text style={styles.primaryButtonText}>Pay</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => void handleShare()}>
              <Text style={styles.secondaryButtonText}>Share package</Text>
            </Pressable>
            {shareNote !== null ? (
              <Text style={styles.note}>{shareNote}</Text>
            ) : null}
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => callAction()}>
              <Text style={styles.secondaryButtonText}>
                Call {CONTACT_PHONE_DISPLAY}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => whatsappAction(enquiryMessage(pkg.title))}>
              <Text style={styles.secondaryButtonText}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() =>
                navigation.navigate('Tabs', {
                  screen: 'Chat',
                  params: { slug: pkg.slug, packageName: pkg.title },
                })
              }>
              <Text style={styles.secondaryButtonText}>
                Chat about this package
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() =>
                navigation.navigate('Trust', { packageName: pkg.title })
              }>
              <Text style={styles.secondaryButtonText}>Why trust us</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() =>
                navigation.navigate('ReportIssue', { packageName: pkg.title })
              }>
              <Text style={styles.secondaryButtonText}>Report wrong info</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() =>
                navigation.navigate('GroupEnquiry', { packageName: pkg.title })
              }>
              <Text style={styles.secondaryButtonText}>
                Group / school booking
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() =>
                navigation.navigate('GiftTrip', { packageName: pkg.title })
              }>
              <Text style={styles.secondaryButtonText}>Gift this trip</Text>
            </Pressable>
            <Text style={[styles.sourceNote, { color: colors.muted }]}>
              {catalog.source === 'live'
                ? 'Live catalogue'
                : catalog.source === 'cache'
                  ? 'Saved catalogue (offline)'
                  : 'Bundled catalogue'}
              {catalog.error !== null ? ' — live refresh failed, showing saved data.' : ''}
            </Text>
          </View>
          <View style={styles.noteSection}>
            <Text style={[styles.noteLabel, { color: colors.text }]}>
              My note
            </Text>
            <TextInput
              style={[styles.noteInput, { color: colors.text, borderColor: colors.border }]}
              value={note}
              onChangeText={(value) => {
                setNote(value);
                setNoteSaved(false);
              }}
              placeholder="e.g. ask Amit about the hotel"
              placeholderTextColor={colors.muted}
              multiline
            />
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                void setPackageNote(pkg.slug, note).then(() => setNoteSaved(true));
              }}>
              <Text style={styles.secondaryButtonText}>Save note</Text>
            </Pressable>
            {noteSaved ? (
              <Text style={styles.note}>Note saved on this device.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  body: {
    padding: SPACING.lg,
  },
  caption: {
    fontSize: FONT.meta,
    color: COLORS.muted,
    marginTop: SPACING.sm,
  },
  title: {
    fontSize: FONT.title,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  meta: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
  },
  priceNote: {
    fontSize: FONT.meta,
    color: COLORS.muted,
    marginTop: SPACING.sm,
  },
  note: {
    fontSize: FONT.meta,
    color: COLORS.muted,
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
  noteSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  noteLabel: {
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: RADII.card,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: SPACING.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sourceNote: {
    fontSize: FONT.meta,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: FONT.heading,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
    marginTop: 20,
  },
  sectionText: {
    fontSize: FONT.body,
    lineHeight: 22,
    color: COLORS.text,
    marginTop: 6,
  },
  stopRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    alignItems: 'flex-start',
  },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: FONT.meta,
    fontWeight: WEIGHT.bold,
    overflow: 'hidden',
  },
  stopText: {
    flex: 1,
    fontSize: FONT.body,
    lineHeight: 22,
    color: COLORS.text,
  },
  similarRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  similarCard: {
    width: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.card,
    padding: SPACING.md,
  },
  similarTitle: {
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
    lineHeight: 20,
  },
  similarMeta: {
    fontSize: FONT.meta,
    color: COLORS.muted,
    marginTop: SPACING.xs,
  },
  similarPrice: {
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  actions: {
    marginTop: SPACING.xl,
    gap: 10,
    paddingBottom: SPACING.xl,
  },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  notFoundText: {
    fontSize: FONT.body,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
