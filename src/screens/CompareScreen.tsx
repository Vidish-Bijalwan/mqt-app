/**
 * Compare screen (v1.3 item 28): up to 3 packages side by side.
 *
 * Real fields only: title, category, duration, route, price (via
 * priceInfo on live entries / getPriceInfo() on bundled entries) and
 * a description excerpt. Anything missing shows as "Not listed" —
 * never invented. The max-3 limit is enforced in toggleCompareSlug
 * (src/lib/search.ts); this screen also never renders a fourth column.
 * Selection is device-local (AsyncStorage '@mqt/compare').
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCatalog } from '../lib/catalog';
import type { CatalogPackage } from '../lib/catalog';
import {
  clearCompareSlugs,
  getSearchPrice,
  listCompareSlugs,
  toggleCompareSlug,
} from '../lib/search';
import type { RootStackParamList } from '../navigation/types';
import { FONT, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Compare'>;

const NOT_LISTED = 'Not listed';
const COLUMN_WIDTH = 260;

function excerpt(description: string): string {
  const trimmed = description.trim();
  if (trimmed === '') return NOT_LISTED;
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}

export function CompareScreen({ navigation }: Props) {
  const catalog = useCatalog();
  const { colors, fs } = useSettings();
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    void listCompareSlugs().then((list) => {
      if (alive) setSlugs(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const packages = slugs
    .map((slug) => catalog.packages.find((p) => p.slug === slug))
    .filter((p): p is CatalogPackage => p !== undefined)
    .slice(0, 3);

  const rows: { label: string; value: (pkg: CatalogPackage) => string }[] = [
    { label: 'Title', value: (pkg) => pkg.title },
    {
      label: 'Category',
      value: (pkg) => (pkg.category !== '' ? pkg.category : NOT_LISTED),
    },
    {
      label: 'Duration',
      value: (pkg) => (pkg.duration !== '' ? pkg.duration : NOT_LISTED),
    },
    {
      label: 'Route',
      value: (pkg) => (pkg.route !== '' ? pkg.route : NOT_LISTED),
    },
    {
      label: 'Price',
      value: (pkg) => {
        const price = getSearchPrice(pkg);
        return price.hasPrice ? price.display : NOT_LISTED;
      },
    },
    { label: 'About', value: (pkg) => excerpt(pkg.description) },
  ];

  const handleRemove = (slug: string) => {
    void toggleCompareSlug(slug).then(({ slugs: next }) => setSlugs(next));
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Compare packages
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          Up to 3 packages, side by side. Add more from Search
          (long-press a result card).
        </Text>
        {packages.length > 0 ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              void clearCompareSlugs().then(() => setSlugs([]));
            }}>
            <Text style={[styles.clearText, { color: colors.primary }]}>
              Clear comparison
            </Text>
          </Pressable>
        ) : null}
      </View>
      {packages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nothing to compare yet. Go to Search, long-press a package
            card and choose “Add to compare (max 3)”.
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Search')}>
            <Text style={styles.emptyButtonText}>Go to Search</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text
                  style={[
                    styles.rowLabel,
                    { color: colors.muted, width: 90 },
                  ]}>
                  {row.label}
                </Text>
                {packages.map((pkg) => (
                  <Text
                    key={pkg.slug}
                    style={[
                      styles.cell,
                      { color: colors.text, width: COLUMN_WIDTH },
                    ]}>
                    {row.value(pkg)}
                  </Text>
                ))}
              </View>
            ))}
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.muted, width: 90 }]}>
                Actions
              </Text>
              {packages.map((pkg) => (
                <View
                  key={pkg.slug}
                  style={[styles.cellWrap, { width: COLUMN_WIDTH }]}>
                  <Pressable
                    style={styles.detailButton}
                    onPress={() =>
                      navigation.navigate('PackageDetail', { slug: pkg.slug })
                    }>
                    <Text style={styles.detailButtonText}>View details</Text>
                  </Pressable>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemove(pkg.slug)}>
                    <Text
                      style={[styles.removeText, { color: colors.primary }]}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontWeight: WEIGHT.bold },
  meta: { fontSize: FONT.meta, marginTop: SPACING.xs, lineHeight: 18 },
  clearButton: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  clearText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  empty: { padding: SPACING.lg, gap: SPACING.md },
  emptyText: { fontSize: FONT.body, lineHeight: 22 },
  emptyButton: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#127C82',
    borderRadius: 10,
    paddingHorizontal: SPACING.lg,
  },
  emptyButtonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold, fontSize: FONT.body },
  table: { padding: SPACING.lg, gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  rowLabel: { fontSize: FONT.meta, fontWeight: WEIGHT.bold, paddingTop: 2 },
  cell: { fontSize: FONT.body, lineHeight: 20 },
  cellWrap: { gap: SPACING.sm },
  detailButton: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#127C82',
    borderRadius: 10,
  },
  detailButtonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold, fontSize: 14 },
  removeButton: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  removeText: { fontSize: 14, fontWeight: WEIGHT.bold },
});
