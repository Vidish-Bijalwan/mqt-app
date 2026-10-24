/**
 * Destination guide hub — detail (v2, item 99).
 *
 * Params: { category: string } — the category name as it appears in
 * the catalogue/feed. Packages and articles are filtered by exact
 * category match from the real sources; nothing is cross-matched by
 * keyword. FAQ content is NOT duplicated here: the app's only FAQ copy
 * lives in the Chat tab (ChatScreen, not a shared module), so this
 * screen links to the Chat tab's FAQ section and to call/WhatsApp.
 * That gap (no shared FAQ module) is reported honestly to the
 * coordinator rather than papered over with invented FAQ text.
 */
import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { useBlogPosts } from '../lib/blog';
import { useCatalog } from '../lib/catalog';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  whatsappAction,
} from '../lib/contact';

type RouteParams = { category?: string };

export function DestinationHubScreen() {
  const navigation = useNavigation() as unknown as {
    navigate: (name: string, params?: Record<string, unknown>) => void;
  };
  const route = useRoute() as unknown as { params?: RouteParams };
  const category = route.params?.category ?? '';
  const { colors, fs } = useSettings();
  const { posts } = useBlogPosts();
  const { packages } = useCatalog();

  const hubPackages = packages.filter((p) => p.category === category);
  const hubArticles = posts.filter((p) => p.category === category);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {category !== '' ? category : 'Destination guide'}
        </Text>

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Packages
        </Text>
        {hubPackages.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No packages in this category yet.
          </Text>
        ) : (
          hubPackages.map((p) => (
            <Pressable
              key={p.slug}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() =>
                navigation.navigate('PackageDetail', { slug: p.slug })
              }>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]} numberOfLines={2}>
                {p.title}
              </Text>
              {p.duration !== '' ? (
                <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                  {p.duration}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Articles
        </Text>
        {hubArticles.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No articles in this category yet.
          </Text>
        ) : (
          hubArticles.map((a) => (
            <Pressable
              key={a.slug}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() =>
                navigation.navigate('BlogArticle', { slug: a.slug, title: a.title })
              }>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]} numberOfLines={2}>
                {a.title}
              </Text>
            </Pressable>
          ))
        )}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Questions & contact
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Frequently asked questions live in the Chat tab. For anything
          specific to this destination, ask the team directly.
        </Text>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.navigate('Tabs', { screen: 'Chat' })}>
          <Text style={styles.buttonText}>FAQs in the Chat tab</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={callAction}>
          <Text style={styles.buttonText}>Call {CONTACT_PHONE_DISPLAY}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() =>
            whatsappAction(
              `Hi My Quick Trippers! I have a question about ${category !== '' ? category : 'a destination'}.`,
            )
          }>
          <Text style={styles.buttonText}>WhatsApp the team</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.outlineButton]}
          onPress={() => Linking.openURL('https://www.myquicktrippers.com/terms-and-conditions')}>
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
            Read the Terms page
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  heading: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  note: { marginTop: SPACING.sm, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.md, marginTop: SPACING.sm },
  cardTitle: { fontWeight: WEIGHT.bold },
  cardMeta: { marginTop: SPACING.xs },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
  },
  primaryButton: { backgroundColor: '#127C82' },
  whatsappButton: { backgroundColor: '#25D366' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
});
