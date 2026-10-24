import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useCatalog } from '../lib/catalog';
import { useAppConfig } from '../lib/appConfig';
import { getHomeCardDensity } from '../lib/experiments';
import { useSettings } from '../context/SettingsContext';
import type { Package } from '../data/packages';
import type { RootStackParamList } from '../navigation/types';
import { HeaderLogo } from '../components/HeaderLogo';
import { PackageList } from '../components/PackageList';
import { FilterSheet } from '../components/FilterSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function matchesQuery(pkg: Package, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    pkg.title.toLowerCase().includes(q) ||
    pkg.category.toLowerCase().includes(q)
  );
}

/**
 * Home (v1.2 wiring): same layout as v1.1, but the list now comes from
 * useCatalog() — live first, cache/bundled fallback, with a small source
 * indicator and a refresh affordance. Visuals are otherwise unchanged;
 * PackageList's inner cards are owned by another builder and still use
 * the light tokens (see the v1.2 report's theme-coverage note).
 */
export function HomeScreen({ navigation }: Props) {
  const catalog = useCatalog();
  const { colors } = useSettings();
  // ---- BEGIN v2 item 208 (A/B: home card density) — owned block ----
  // Variant comes from remote-config flags via experiments.ts; missing
  // flags resolve offline to the safe default ('comfortable'). Both
  // variants render the same real PackageList below — density here
  // varies Home-level spacing (search/filter/list chrome), because
  // card internals live in PackageList (another builder's file) and
  // this file must not edit it. COORDINATOR NOTE: AppFlags does not
  // yet carry the exp_home-card-density key (see experiments.ts), so
  // the default applies until that one-line parse addition lands.
  const { config } = useAppConfig();
  const density = getHomeCardDensity(config?.flags ?? null);
  const isCompact = density === 'compact';
  // ---- END v2 item 208 ----
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const categories = useMemo(
    () => Array.from(new Set(catalog.packages.map((p) => p.category))),
    [catalog.packages],
  );

  const filtered = useMemo(
    () =>
      catalog.packages.filter(
        (pkg) =>
          (category === null || pkg.category === category) &&
          matchesQuery(pkg, query),
      ),
    [catalog.packages, query, category],
  );

  const activeFilterCount = category === null ? 0 : 1;

  const sourceLabel =
    catalog.source === 'live'
      ? 'Live catalogue'
      : catalog.source === 'cache'
        ? 'Saved catalogue (offline)'
        : 'Bundled catalogue';

  const handleRefresh = () => {
    setRefreshing(true);
    catalog.refresh();
    setTimeout(() => {
      setLastRefreshed(new Date());
      setRefreshing(false);
    }, 250);
  };

  const lastRefreshedLabel = lastRefreshed.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderLogo variant="white" size={100} />
        <Text style={styles.brandName} numberOfLines={1}>
          My Quick Trippers
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Blog')}
          style={styles.blogButton}>
          <Text style={styles.blogButtonText}>Blog</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.searchWrap,
          // v2 item 208: density variant spacing (see owned block above).
          isCompact ? styles.searchWrapCompact : styles.searchWrapComfortable,
        ]}>
        <TextInput
          style={[styles.search, { borderColor: colors.border, color: colors.text }]}
          placeholder="Search packages or destinations…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      <View
        style={[
          styles.filterRow,
          // v2 item 208: density variant spacing (see owned block above).
          isCompact ? styles.filterRowCompact : styles.filterRowComfortable,
        ]}>
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={styles.filtersButton}>
          <Text style={styles.filtersButtonText}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
        <Text style={styles.refreshStamp} numberOfLines={1}>
          {sourceLabel} · {lastRefreshedLabel}
        </Text>
      </View>
      {catalog.error !== null ? (
        <Pressable onPress={catalog.refresh} style={styles.errorRow}>
          <Text style={styles.errorText} numberOfLines={2}>
            {catalog.error.message} Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.listWrap,
          // v2 item 208: density variant spacing (see owned block above).
          isCompact ? styles.listWrapCompact : styles.listWrapComfortable,
        ]}>
        <PackageList
          packages={filtered}
          onPressPackage={(pkg) =>
            navigation.navigate('PackageDetail', { slug: pkg.slug })
          }
          onEnquirePackage={(pkg) =>
            navigation.navigate('Enquiry', {
              slug: pkg.slug,
              packageName: pkg.title,
            })
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      </View>

      <FilterSheet
        visible={sheetVisible}
        categories={categories}
        selected={category}
        onClose={() => setSheetVisible(false)}
        onApply={(c) => setCategory(c)}
        onClear={() => setCategory(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  brandName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: WEIGHT.bold,
    color: COLORS.white,
  },
  blogButton: {
    marginLeft: 'auto',
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: RADII.chip,
    paddingHorizontal: 14,
  },
  blogButtonText: {
    color: COLORS.white,
    fontWeight: WEIGHT.medium,
    fontSize: 14,
  },
  searchWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  // v2 item 208: density variants (comfortable = shipped spacing).
  searchWrapCompact: { paddingTop: SPACING.xs, paddingHorizontal: SPACING.md },
  searchWrapComfortable: { paddingTop: SPACING.md, paddingHorizontal: SPACING.lg },
  search: {
    height: TOUCH_MIN,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.button,
    paddingHorizontal: 14,
    fontSize: FONT.body,
    color: COLORS.text,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  // v2 item 208: density variants (comfortable = shipped spacing).
  filterRowCompact: { marginTop: 0, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  filterRowComfortable: { marginTop: SPACING.sm, paddingHorizontal: SPACING.lg, gap: SPACING.md },
  filtersButton: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
  },
  filtersButtonText: {
    color: COLORS.primary,
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
  },
  refreshStamp: {
    flex: 1,
    flexShrink: 1,
    fontSize: FONT.meta,
    color: COLORS.muted,
    textAlign: 'right',
  },
  errorRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.errorBg,
  },
  errorText: { fontSize: FONT.meta, color: COLORS.errorText },
  listWrap: {
    flex: 1,
  },
  // v2 item 208: density variants. The list itself is PackageList
  // (another builder's file); these wrap styles are Home-level only.
  listWrapCompact: { paddingTop: 0 },
  listWrapComfortable: { paddingTop: SPACING.sm },
});
