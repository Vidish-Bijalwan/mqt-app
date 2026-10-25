import React from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FONT, RADII, SPACING, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { packageSiteUrl } from '../lib/booking';
import type { Package } from '../data/packages';
import { packageImageUrl } from '../data/packages';
import { getPriceInfo } from '../lib/price';
import { callAction } from '../lib/contact';
// whatsappEnquiryUrl lives in src/constants.ts (not src/lib/contact.ts,
// despite the v1.1 brief's wording); it builds the same wa.me deep link.
import { whatsappEnquiryUrl } from '../constants';
import { PackageImage, optimizedImageUrl } from './PackageImage';
import { lowDataOptimizedUrl } from '../lib/lowdata';
import { Image as ExpoImage } from 'expo-image';
import { PriceBlock } from './PriceBlock';
import { FadeInView, PressScale } from './Motion';

interface Props {
  packages: Package[];
  onPressPackage: (pkg: Package) => void;
  onEnquirePackage: (pkg: Package) => void;
  ListHeaderComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Optional wishlist/compare actions (v1.3 items 28/29), surfaced
   * through the existing long-press menu — not as nested buttons
   * inside the card Pressable, which would also fire card navigation.
   * Screens that do not pass these props keep the old menu exactly.
   */
  onToggleWishlist?: (pkg: Package) => void;
  isWishlisted?: (slug: string) => boolean;
  onToggleCompare?: (pkg: Package) => void;
  isInCompare?: (slug: string) => boolean;
}

/**
 * Virtualized package list (item 132). Only visible cards mount: the
 * 652-package catalogue must not render all at once. No getItemLayout —
 * card heights vary with title length, so fixed heights would be faked.
 *
 * Long-press on a card opens an action menu with ONLY real actions:
 * Share, Enquire, Call, WhatsApp. No compare/wishlist — those features
 * do not exist yet and must not be offered.
 */
// Module-level: VirtualizedList throws ("Changing ... on the fly is
// not supported") and unmounts the whole tree if onViewableItemsChanged
// or viewabilityConfig change identity between renders, so both must
// be referentially stable for the life of the list.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

export function PackageList({
  packages,
  onPressPackage,
  onEnquirePackage,
  ListHeaderComponent,
  refreshing,
  onRefresh,
  onToggleWishlist,
  isWishlisted,
  onToggleCompare,
  isInCompare,
}: Props) {
  const { colors, fs, settings } = useSettings();
  // v2.0.2 finger-fast detail: when the visible set changes, prefetch
  // the EXACT optimizer URLs the detail screen will request for those
  // cards (see PackageImage: w=750, or w=640 in low-data mode), so a
  // tap hits the expo-image disk cache instead of a slow download.
  // Fire-and-forget and deduped: prefetching never delays rendering
  // or navigation, and a failure is silently ignored (the detail's
  // own image pipeline still loads the photo, with its placeholder).
  const prefetchedRef = React.useRef(new Set<string>());
  // dataSaver is read through a ref so prefetchVisible (and therefore
  // the FlatList handler below) keeps a stable identity even if the
  // setting toggles — a changing onViewableItemsChanged identity is a
  // fatal VirtualizedList error on web (it unmounts the whole tree).
  const dataSaverRef = React.useRef(settings.dataSaver);
  React.useEffect(() => {
    dataSaverRef.current = settings.dataSaver;
  }, [settings.dataSaver]);
  // Shared URL builder for every prefetch path: the EXACT optimizer
  // URL the detail screen will request for that card (PackageImage:
  // w=750, or w=640 in low-data mode), so a tap hits the expo-image
  // disk cache instead of a slow download. Deduped by URL and
  // fire-and-forget: a prefetch failure is silently ignored (the
  // detail's own image pipeline still loads the photo).
  const prefetchPackages = React.useCallback((items: Package[]) => {
    const urls: string[] = [];
    for (const item of items) {
      const raw = packageImageUrl(item);
      const detailUrl =
        raw !== null
          ? (dataSaverRef.current
              ? lowDataOptimizedUrl(raw)
              : null) ?? optimizedImageUrl(raw) ?? raw
          : null;
      if (detailUrl !== null && !prefetchedRef.current.has(detailUrl)) {
        prefetchedRef.current.add(detailUrl);
        urls.push(detailUrl);
      }
    }
    if (urls.length > 0) {
      void ExpoImage.prefetch(urls, 'memory-disk').catch(() => undefined);
    }
  }, []);
  const prefetchVisible = React.useCallback((items: { item: Package }[]) => {
    prefetchPackages(items.map(({ item }) => item));
  }, [prefetchPackages]);
  const handleViewableItemsChanged = React.useCallback(
    ({ viewableItems }: { viewableItems: { item: Package }[] }) => {
      prefetchVisible(viewableItems);
    },
    [prefetchVisible],
  );
  return (
    <FlatList
      data={packages}
      keyExtractor={(pkg) => pkg.slug}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews={Platform.OS === 'android'}
      contentContainerStyle={styles.list}
      ListHeaderComponent={ListHeaderComponent ?? undefined}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          No packages match your search. Try a different destination or
          category.
        </Text>
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined
      }
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={VIEWABILITY_CONFIG}
      renderItem={({ item, index }) => (
        <FadeInView index={index}>
          <PackageCard
            pkg={item}
            // v2.0.3: widen prefetch from "viewable only" to the
            // rendered window + neighbours. FlatList mounts cards for
            // the rendered window (initialNumToRender / windowSize),
            // which is wider than the 50%-visible viewability set, so
            // each card prefetches itself + its immediate neighbours
            // on mount (deduped by URL in prefetchPackages, so a
            // re-render never re-downloads).
            neighbors={[
              packages[index - 1],
              item,
              packages[index + 1],
            ].filter((p): p is Package => p !== undefined)}
            prefetchPackages={prefetchPackages}
            onPress={() => onPressPackage(item)}
            onLongPress={() =>
              showCardActions(item, onEnquirePackage, {
                onToggleWishlist,
                isWishlisted,
                onToggleCompare,
                isInCompare,
              })
            }
          />
        </FadeInView>
      )}
    />
  );
}

function showCardActions(
  pkg: Package,
  onEnquirePackage: (pkg: Package) => void,
  extra: {
    onToggleWishlist?: (pkg: Package) => void;
    isWishlisted?: (slug: string) => boolean;
    onToggleCompare?: (pkg: Package) => void;
    isInCompare?: (slug: string) => boolean;
  },
): void {
  Alert.alert(pkg.title, undefined, [
    {
      text: 'Share',
      onPress: () => {
        void Share.share({
          // Rich share card (item 195): title + verified site link.
          message: `${pkg.title} — My Quick Trippers\n${packageSiteUrl(pkg.slug)}`,
        });
      },
    },
    { text: 'Enquire', onPress: () => onEnquirePackage(pkg) },
    ...(extra.onToggleWishlist !== undefined
      ? [
          {
            text:
              extra.isWishlisted?.(pkg.slug) === true
                ? 'Remove from wishlist'
                : 'Save to wishlist',
            onPress: () => extra.onToggleWishlist?.(pkg),
          },
        ]
      : []),
    ...(extra.onToggleCompare !== undefined
      ? [
          {
            text:
              extra.isInCompare?.(pkg.slug) === true
                ? 'Remove from compare'
                : 'Add to compare (max 3)',
            onPress: () => extra.onToggleCompare?.(pkg),
          },
        ]
      : []),
    { text: 'Call', onPress: () => void callAction() },
    {
      text: 'WhatsApp',
      onPress: () => {
        void Linking.openURL(whatsappEnquiryUrl(pkg.title));
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function PackageCard({
  pkg,
  neighbors,
  prefetchPackages,
  onPress,
  onLongPress,
}: {
  pkg: Package;
  neighbors: Package[];
  prefetchPackages: (items: Package[]) => void;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, fs } = useSettings();
  const price = getPriceInfo(pkg);
  // v2.0.3 rendered-window prefetch (see renderItem): runs once per
  // card mount. Neighbours are deliberately NOT in the dep list — the
  // list order does not change under a mounted card, and the URL
  // dedup in prefetchPackages makes any re-run a no-op anyway.
  React.useEffect(() => {
    prefetchPackages(neighbors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.slug]);
  return (
    <PressScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityLabel={pkg.title}>
      <PackageImage uri={packageImageUrl(pkg)} height={180} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.heading) }]} numberOfLines={2}>
          {pkg.title}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          {pkg.category}
          {pkg.duration ? `  ·  ${pkg.duration}` : ''}
        </Text>
        <PriceBlock price={price} />
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: RADII.card,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: FONT.heading,
    fontWeight: WEIGHT.bold,
  },
  cardMeta: {
    fontSize: FONT.meta,
    marginTop: SPACING.xs,
  },
  empty: {
    fontSize: FONT.body,
    textAlign: 'center',
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
});
