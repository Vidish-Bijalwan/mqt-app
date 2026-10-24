import React from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
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
import { PackageImage } from './PackageImage';
import { PriceBlock } from './PriceBlock';

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
  const { colors, fs } = useSettings();
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
      renderItem={({ item }) => (
        <PackageCard
          pkg={item}
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
  onPress,
  onLongPress,
}: {
  pkg: Package;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, fs } = useSettings();
  const price = getPriceInfo(pkg);
  return (
    <Pressable
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
    </Pressable>
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
