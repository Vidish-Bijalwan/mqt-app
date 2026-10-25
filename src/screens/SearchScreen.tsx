/**
 * Search screen (v1.3 Category C, items 21–26, 28, 29).
 *
 * - Full-text search with typo tolerance (src/lib/search.ts).
 * - Multi-filter (category, budget, duration) + sort via FilterSheet.
 * - Last search/filter/sort persisted and restored (item 24).
 * - Search history + saved searches with price-change detection
 *   (item 25). Detection only: no push/notification mechanism is
 *   invented here — surfacing is wired at integration.
 * - Curated collections computed from real catalogue data (item 26).
 * - Wishlist + compare entry points (items 28/29); long-press a
 *   result card for Save to wishlist / Add to compare.
 * - Voice search is NOT offered here: item 30 is DEFERRED (see the
 *   header comment in src/lib/search.ts) and no fake mic button ships.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchBar } from '../components/SearchBar';
import { FilterSheet } from '../components/FilterSheet';
import { PackageList } from '../components/PackageList';
import { useCatalog } from '../lib/catalog';
import type { CatalogPackage } from '../lib/catalog';
import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  addSearchHistory,
  applySearch,
  categoriesOf,
  clearSearchHistory,
  deleteSavedSearch,
  detectSavedSearchPriceChanges,
  getCollections,
  getSearchPrice,
  listCompareSlugs,
  listSavedSearches,
  listSearchHistory,
  loadSearchState,
  saveSavedSearch,
  saveSearchState,
  toggleCompareSlug,
} from '../lib/search';
import type {
  SavedSearch,
  SearchFilters,
  SortId,
} from '../lib/search';
import {
  buildWishlistShareText,
  listWishlist,
  setWishlistPriceSnapshot,
  toggleWishlist,
} from '../lib/wishlist';
import type { RootStackParamList } from '../navigation/types';
import { FONT, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const COLLECTION_FILTERS: Record<
  string,
  { filters: SearchFilters; note: string }
> = {
  under25k: {
    filters: { category: null, budget: 'under25k', duration: 'all' },
    note: 'Trips under ₹25,000',
  },
  weekend: {
    filters: { category: null, budget: 'all', duration: 'upto3' },
    note: 'Weekend getaways',
  },
  pilgrimage: {
    filters: { category: 'Pilgrimage', budget: 'all', duration: 'all' },
    note: 'Pilgrimage circuits',
  },
};

export function SearchScreen({ navigation, route }: Props) {
  const catalog = useCatalog();
  const { colors, fs } = useSettings();
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortId>('price-asc');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [wishlistSlugs, setWishlistSlugs] = useState<string[]>([]);
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  // Params (collection/query) are applied inside the async load below,
  // not in a separate effect: setState in an async callback after an
  // await is not a synchronous effect-body setState.

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [state, hist, savedList, wish, comp] = await Promise.all([
        loadSearchState(),
        listSearchHistory(),
        listSavedSearches(),
        listWishlist(),
        listCompareSlugs(),
      ]);
      if (!alive) return;
      let nextQuery = state.query;
      let nextFilters = state.filters;
      const params = route.params;
      if (params?.collection !== undefined) {
        const preset = COLLECTION_FILTERS[params.collection];
        if (preset !== undefined) nextFilters = preset.filters;
      }
      if (params?.query !== undefined && params.query !== '') {
        nextQuery = params.query;
      }
      setQuery(nextQuery);
      setFilters(nextFilters);
      setSort(state.sort);
      setHistory(hist);
      setSaved(savedList);
      setWishlistSlugs(wish);
      setCompareSlugs(comp);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [route.params]);

  useEffect(() => {
    if (!loaded) return;
    void saveSearchState({ query, filters, sort });
  }, [loaded, query, filters, sort]);

  const categories = useMemo(
    () => categoriesOf(catalog.packages),
    [catalog.packages],
  );
  const collections = useMemo(
    () => getCollections(catalog.packages),
    [catalog.packages],
  );
  const results = useMemo(
    () => applySearch(catalog.packages, query, filters, sort),
    [catalog.packages, query, filters, sort],
  );
  const priceChanges = useMemo(
    () => detectSavedSearchPriceChanges(saved, catalog.packages),
    [saved, catalog.packages],
  );
  const changesBySaved = useMemo(() => {
    const map = new Map<string, number>();
    for (const change of priceChanges) {
      map.set(
        change.savedSearchId,
        (map.get(change.savedSearchId) ?? 0) + 1,
      );
    }
    return map;
  }, [priceChanges]);
  const wishlistPackages = useMemo(
    () =>
      wishlistSlugs
        .map((slug) => catalog.packages.find((p) => p.slug === slug))
        .filter((p): p is CatalogPackage => p !== undefined),
    [wishlistSlugs, catalog.packages],
  );

  const activeFilterCount =
    (filters.category !== null ? 1 : 0) +
    (filters.budget !== 'all' ? 1 : 0) +
    (filters.duration !== 'all' ? 1 : 0);

  const handleSubmitSearch = () => {
    void addSearchHistory(query).then(setHistory);
  };

  const handleToggleWishlist = (pkg: CatalogPackage) => {
    void toggleWishlist(pkg.slug).then((next) => {
      setWishlistSlugs(next);
      if (next.includes(pkg.slug)) {
        void setWishlistPriceSnapshot(
          pkg.slug,
          getSearchPrice(pkg).display,
        );
      }
    });
  };

  const handleToggleCompare = (pkg: CatalogPackage) => {
    void toggleCompareSlug(pkg.slug).then(({ slugs, atLimit }) => {
      setCompareSlugs(slugs);
      setNotice(
        atLimit
          ? 'Compare holds up to 3 packages. Remove one to add another.'
          : '',
      );
    });
  };

  const handleSaveSearch = () => {
    void saveSavedSearch(query, filters, sort, results).then((entry) => {
      if (entry === null) {
        setNotice('This search is already saved.');
      } else {
        setNotice('Search saved.');
        void listSavedSearches().then(setSaved);
      }
    });
  };

  const handleApplySaved = (entry: SavedSearch) => {
    setQuery(entry.query);
    setFilters(entry.filters);
    setSort(entry.sort);
    setNotice(`Applied saved search: ${entry.query || 'all packages'}.`);
  };

  const handleShareWishlist = () => {
    void Share.share({ message: buildWishlistShareText(wishlistPackages) });
  };

  const sortLabel =
    SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'Price: low to high';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <PackageList
        packages={results}
        onPressPackage={(pkg) =>
          navigation.navigate('PackageDetail', { slug: pkg.slug, package: pkg })
        }
        onEnquirePackage={(pkg) =>
          navigation.navigate('Enquiry', {
            slug: pkg.slug,
            packageName: pkg.title,
          })
        }
        onToggleWishlist={(pkg) =>
          handleToggleWishlist(pkg as CatalogPackage)
        }
        isWishlisted={(slug) => wishlistSlugs.includes(slug)}
        onToggleCompare={(pkg) =>
          handleToggleCompare(pkg as CatalogPackage)
        }
        isInCompare={(slug) => compareSlugs.includes(slug)}
        ListHeaderComponent={
          <View style={styles.top}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              onSubmit={handleSubmitSearch}
            />
        <Text style={[styles.voiceNote, { color: colors.muted }]}>
          Voice search is not available yet — it needs a native build
          (see item 30, deferred).
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}>
          {collections.map((collection) => (
            <Pressable
              key={collection.id}
              style={styles.chip}
              onPress={() => {
                const preset = COLLECTION_FILTERS[collection.id];
                if (preset !== undefined) setFilters(preset.filters);
              }}>
              <Text style={[styles.chipText, { color: colors.primary }]}>
                {collection.title} ({collection.packages.length})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {history.length > 0 ? (
          <View style={styles.historyRow}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              Recent searches
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {history.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.historyChip, { borderColor: colors.border }]}
                  onPress={() => setQuery(item)}>
                  <Text style={[styles.historyText, { color: colors.text }]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.historyChip, { borderColor: colors.border }]}
                onPress={() => {
                  void clearSearchHistory().then(() => setHistory([]));
                }}>
                <Text style={[styles.historyText, { color: colors.primary }]}>
                  Clear history
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => setSheetVisible(true)}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleSaveSearch}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Save this search
            </Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate('Compare')}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Compare ({compareSlugs.length}/3)
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.meta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          {results.length} results · Sorted: {sortLabel}
        </Text>
        {notice !== '' ? (
          <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text>
        ) : null}
        {saved.length > 0 ? (
          <View style={styles.savedBlock}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              Saved searches
            </Text>
            {saved.map((entry) => {
              const changed = changesBySaved.get(entry.id) ?? 0;
              return (
                <View key={entry.id} style={styles.savedRow}>
                  <Pressable
                    style={styles.savedMain}
                    onPress={() => handleApplySaved(entry)}>
                    <Text
                      style={[styles.savedText, { color: colors.text }]}
                      numberOfLines={1}>
                      {entry.query !== '' ? entry.query : 'All packages'}
                    </Text>
                    {changed > 0 ? (
                      <Text
                        style={[styles.savedNote, { color: colors.primary }]}>
                        Price changed on {changed} package
                        {changed === 1 ? '' : 's'} since saved
                      </Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    style={styles.savedDelete}
                    onPress={() => {
                      void deleteSavedSearch(entry.id).then(() =>
                        listSavedSearches().then(setSaved),
                      );
                    }}>
                    <Text style={[styles.savedDeleteText, { color: colors.primary }]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
        {wishlistPackages.length > 0 ? (
          <View style={styles.savedBlock}>
            <View style={styles.wishlistHeader}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>
                Wishlist ({wishlistPackages.length})
              </Text>
              <Pressable onPress={handleShareWishlist}>
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  Share wishlist
                </Text>
              </Pressable>
            </View>
            {wishlistPackages.map((pkg) => (
              <View key={pkg.slug} style={styles.savedRow}>
                <Pressable
                  style={styles.savedMain}
                  onPress={() =>
                    navigation.navigate('PackageDetail', { slug: pkg.slug, package: pkg })
                  }>
                  <Text
                    style={[styles.savedText, { color: colors.text }]}
                    numberOfLines={1}>
                    {pkg.title}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.savedDelete}
                  onPress={() => handleToggleWishlist(pkg)}>
                  <Text style={[styles.savedDeleteText, { color: colors.primary }]}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
          </View>
        }
      />
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
  top: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  voiceNote: { fontSize: FONT.meta, marginTop: SPACING.xs },
  chipRow: { marginTop: SPACING.sm },
  chip: {
    borderWidth: 1,
    borderColor: '#127C82',
    borderRadius: 20,
    paddingHorizontal: 14,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  chipText: { fontSize: 14, fontWeight: WEIGHT.medium },
  historyRow: { marginTop: SPACING.sm },
  sectionLabel: {
    fontSize: FONT.meta,
    fontWeight: WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  historyChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  historyText: { fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionButton: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  actionText: { fontSize: 14, fontWeight: WEIGHT.bold },
  meta: { marginTop: SPACING.xs },
  notice: { fontSize: FONT.meta, marginTop: SPACING.xs },
  savedBlock: { marginTop: SPACING.sm },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  savedMain: { flex: 1, minHeight: TOUCH_MIN, justifyContent: 'center' },
  savedText: { fontSize: FONT.body },
  savedNote: { fontSize: FONT.meta },
  savedDelete: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  savedDeleteText: { fontSize: 13, fontWeight: WEIGHT.bold },
  wishlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
