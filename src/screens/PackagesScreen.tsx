import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Package } from '../data/packages';
import { PackageList } from '../components/PackageList';
import { SearchBar } from '../components/SearchBar';
import { FilterSheet } from '../components/FilterSheet';
import { useCatalog } from '../lib/catalog';
import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  applySearch,
  categoriesOf,
  loadSearchState,
  saveSearchState,
} from '../lib/search';
import type { SearchFilters, SortId } from '../lib/search';
import { listWishlist } from '../lib/wishlist';
import {
  detectPriceDrops,
  syncWatchedSlugs,
} from '../lib/notifications';
import { FONT, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Packages'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Packages tab (v1.2 wiring): same shared PackageList as v1.1, now fed
 * by useCatalog() — live first, cache/bundled fallback — with a small
 * source indicator and a refresh affordance in the header. The list
 * cards themselves are owned by another builder (light tokens only;
 * see the v1.2 report's theme-coverage note).
 *
 * v1.3 (Category C): inline search + multi-filter (category, budget,
 * duration) + sort, sharing the persisted search state with the Search
 * screen (src/lib/search.ts) — the last search/filter/sort is restored
 * on reopen. Month/group/transport filters are deliberately not
 * offered: the catalogue has no field for them.
 */
export function PackagesScreen() {
  const navigation = useNavigation<Nav>();
  const catalog = useCatalog();
  const { colors, fs } = useSettings();
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortId>('price-asc');
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadSearchState().then((state) => {
      if (!alive) return;
      setQuery(state.query);
      setFilters(state.filters);
      setSort(state.sort);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSearchState({ query, filters, sort });
  }, [loaded, query, filters, sort]);

  /**
   * v1.3 integration (item 162): wishlist → price-watch wiring. On each
   * live catalogue, sync the watched set from the wishlist, then detect
   * real price drops. First sightings baseline and never alert, and the
   * stored price always advances, so a drop alerts exactly once. Any
   * failure here is best-effort and must never break the package list.
   */
  useEffect(() => {
    if (catalog.source !== 'live' || catalog.packages.length === 0) return;
    let alive = true;
    void (async () => {
      try {
        const slugs = await listWishlist();
        if (!alive) return;
        await syncWatchedSlugs(slugs);
        if (!alive) return;
        await detectPriceDrops(
          catalog.packages.map((pkg) => ({
            slug: pkg.slug,
            title: pkg.title,
            price: pkg.priceInfo?.display ?? pkg.dealPrice ?? '',
          })),
        );
      } catch {
        // Best-effort only; the list itself is unaffected.
      }
    })();
    return () => {
      alive = false;
    };
  }, [catalog.packages, catalog.source]);

  const categories = useMemo(
    () => categoriesOf(catalog.packages),
    [catalog.packages],
  );
  const results = useMemo(
    () => applySearch(catalog.packages, query, filters, sort),
    [catalog.packages, query, filters, sort],
  );
  const activeFilterCount =
    (filters.category !== null ? 1 : 0) +
    (filters.budget !== 'all' ? 1 : 0) +
    (filters.duration !== 'all' ? 1 : 0);
  const sortLabel =
    SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'Price: low to high';

  const sourceLabel =
    catalog.source === 'live'
      ? 'Live catalogue'
      : catalog.source === 'cache'
        ? 'Saved catalogue (offline)'
        : 'Bundled catalogue';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      {catalog.loading && catalog.packages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <PackageList
          packages={results}
          onPressPackage={(pkg: Package) =>
            navigation.navigate('PackageDetail', { slug: pkg.slug })
          }
          onEnquirePackage={(pkg: Package) =>
            navigation.navigate('Enquiry', {
              slug: pkg.slug,
              packageName: pkg.title,
            })
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
                Packages
              </Text>
              <Text style={[styles.count, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                {results.length} of {catalog.packages.length} trips · {sourceLabel}
              </Text>
              <View style={styles.searchWrap}>
                <SearchBar value={query} onChangeText={setQuery} />
              </View>
              <View style={styles.filterRow}>
                <Pressable
                  style={styles.filtersButton}
                  onPress={() => setSheetVisible(true)}>
                  <Text style={[styles.filtersText, { color: colors.primary }]}>
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.searchButton}
                  onPress={() => navigation.navigate('Search')}>
                  <Text style={[styles.filtersText, { color: colors.primary }]}>
                    Advanced search
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.sortLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                Sorted: {sortLabel} · Change sort in Filters
              </Text>
              <View style={styles.headerRow}>
                <Pressable style={styles.refreshButton} onPress={catalog.refresh}>
                  <Text style={[styles.refreshText, { color: colors.primary }]}>
                    Refresh catalogue
                  </Text>
                </Pressable>
                {catalog.error !== null ? (
                  <Text style={[styles.errorText, { color: colors.errorText }]}>
                    {catalog.error.message}
                  </Text>
                ) : null}
              </View>
            </View>
          }
        />
      )}
      <FilterSheet
        visible={sheetVisible}
        categories={categories}
        selected={filters.category}
        onClose={() => setSheetVisible(false)}
        onApply={(category) => setFilters({ ...filters, category })}
        onClear={() => setFilters(DEFAULT_FILTERS)}
        budget={filters.budget}
        durationBand={filters.duration}
        sort={sort}
        onApplyFilters={(nextFilters, nextSort) => {
          setFilters(nextFilters);
          setSort(nextSort);
        }}
        onClearFilters={() => {
          setFilters(DEFAULT_FILTERS);
          setSort('price-asc');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontWeight: WEIGHT.bold },
  count: { marginTop: SPACING.xs },
  searchWrap: { marginTop: SPACING.md },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  filtersButton: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  searchButton: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  filtersText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  sortLabel: { marginTop: SPACING.xs },
  headerRow: { marginTop: SPACING.sm, gap: SPACING.xs },
  refreshButton: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  refreshText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  errorText: { fontSize: FONT.meta, lineHeight: 18 },
});
