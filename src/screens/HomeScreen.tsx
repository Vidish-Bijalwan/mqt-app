import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BRAND } from '../constants';
import { CATEGORIES, packageImageUrl, packages } from '../data/packages';
import type { Package } from '../data/packages';
import { getPriceInfo } from '../lib/price';
import type { RootStackParamList } from '../navigation/types';
import { PackageImage } from '../components/PackageImage';
import { PriceBlock } from '../components/PriceBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Logo asset: assets/logo.png (copied from the business logo).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/logo.png');

function matchesQuery(pkg: Package, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    pkg.title.toLowerCase().includes(q) ||
    pkg.category.toLowerCase().includes(q)
  );
}

function PackageCard({
  pkg,
  onPress,
}: {
  pkg: Package;
  onPress: () => void;
}) {
  const price = getPriceInfo(pkg);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <PackageImage uri={packageImageUrl(pkg)} height={180} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {pkg.title}
        </Text>
        <Text style={styles.cardMeta}>
          {pkg.category}
          {pkg.duration ? `  ·  ${pkg.duration}` : ''}
        </Text>
        <PriceBlock price={price} />
      </View>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return packages.filter(
      (pkg) =>
        (category === null || pkg.category === category) &&
        matchesQuery(pkg, query),
    );
  }, [query, category]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandName}>My Quick Trippers</Text>
        <Pressable
          onPress={() => navigation.navigate('Blog')}
          style={styles.blogButton}>
          <Text style={styles.blogButtonText}>Blog</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search packages or destinations…"
          placeholderTextColor={BRAND.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      <View style={styles.chipsWrap}>
        <Pressable
          onPress={() => setCategory(null)}
          style={[styles.chip, category === null && styles.chipActive]}>
          <Text
            style={[
              styles.chipText,
              category === null && styles.chipTextActive,
            ]}>
            All
          </Text>
        </Pressable>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}>
            <Text
              style={[
                styles.chipText,
                category === c && styles.chipTextActive,
              ]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(pkg) => pkg.slug}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No packages match your search. Try a different destination or
            category.
          </Text>
        }
        renderItem={({ item }) => (
          <PackageCard
            pkg={item}
            onPress={() =>
              navigation.navigate('PackageDetail', { slug: item.slug })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BRAND.primary,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  blogButton: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  blogButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  search: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: BRAND.text,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
  },
  chipText: {
    fontSize: 14,
    color: BRAND.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: BRAND.cardBackground,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.text,
  },
  cardMeta: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 4,
  },
  empty: {
    fontSize: 15,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
});
