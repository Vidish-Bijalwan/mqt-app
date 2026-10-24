/**
 * Destination guide hubs — list (v2, item 99).
 *
 * One hub per category present in the real catalogue or the real blog
 * feed (see buildDestinationHubs in lib/reading.ts). Counts are real
 * counts from those two sources; a hub with no articles (or no
 * packages) says so on its detail screen instead of inventing content.
 */
import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FONT, RADII, SPACING, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { useBlogPosts } from '../lib/blog';
import { useCatalog } from '../lib/catalog';
import { buildDestinationHubs } from '../lib/reading';

export function DestinationHubsScreen() {
  const navigation = useNavigation() as unknown as {
    navigate: (name: string, params?: Record<string, unknown>) => void;
  };
  const { colors, fs } = useSettings();
  const { posts } = useBlogPosts();
  const { packages } = useCatalog();
  const hubs = buildDestinationHubs(packages, posts);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Destination guides
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Packages and articles from the real catalogue and blog feed,
          grouped by destination category.
        </Text>
      </View>
      <FlatList
        data={hubs}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              No destination guides available yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() =>
              navigation.navigate('DestinationHub', { category: item.title })
            }>
            <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              {item.title}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
              {item.packages.length} package{item.packages.length === 1 ? '' : 's'} ·{' '}
              {item.articles.length} article{item.articles.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontWeight: WEIGHT.bold },
  note: { marginTop: SPACING.sm, lineHeight: 22 },
  list: { padding: SPACING.lg, gap: SPACING.md },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.lg },
  cardTitle: { fontWeight: WEIGHT.bold },
  cardMeta: { marginTop: SPACING.xs },
  center: { alignItems: 'center', padding: SPACING.xl },
});
