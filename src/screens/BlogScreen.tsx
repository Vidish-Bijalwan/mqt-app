/**
 * Blog list (v1.2 rewrite + v2 Category J/P additions).
 *
 * Native list from useBlogPosts() — search, category filter,
 * pull-to-refresh, loading and error states, with an 'Open in browser'
 * fallback to https://www.myquicktrippers.com/blog. Tapping a post
 * opens BlogArticle.
 *
 * v2 additions (all inside this owned screen; new stack screens live
 * in their own files and are wired by the coordinator):
 * - Saved view: articles saved for offline reading (lib/blog.ts).
 * - Followed categories: per-category follow toggles + a "check for
 *   new guides" action that posts in-app centre entries only (97).
 * - Destination hubs preview: hubs from the real catalogue + feed
 *   (lib/reading.ts); tapping a hub shows its packages + articles
 *   inline, with call/WhatsApp contact and a pointer to the Chat tab
 *   FAQ section (99). Video guides render as the honest empty state
 *   (98) — no videos exist today.
 * - Search + category autosave on every change and restore on mount
 *   (156/157) via lib/drafts.ts; rotation/backgrounding cannot lose
 *   them because they live in AsyncStorage, not memory only.
 * - Error state gains a visible retry + "WhatsApp instead" fallback
 *   (154). Low-data mode shows a text-only note (160).
 * No post content is invented: only what the feed returns is shown.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  listSavedArticleBodies,
  readBlogCacheStamp,
  useBlogPosts,
} from '../lib/blog';
import type { BlogPost, SavedArticleBody } from '../lib/blog';
import { useCatalog } from '../lib/catalog';
import {
  buildDestinationHubs,
  checkNewBlogPosts,
  listFollowedCategories,
  toggleFollowedCategory,
  VIDEO_GUIDES_EMPTY_MESSAGE,
} from '../lib/reading';
import {
  loadBlogSearchDraft,
  saveBlogSearchDraft,
} from '../lib/drafts';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  whatsappAction,
} from '../lib/contact';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Blog'>;

const BLOG_URL = 'https://www.myquicktrippers.com/blog';

type Section = 'feed' | 'saved' | 'hubs' | 'videos';

function matchesQuery(post: BlogPost, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    post.title.toLowerCase().includes(q) ||
    post.category.toLowerCase().includes(q) ||
    post.excerpt.toLowerCase().includes(q)
  );
}

function formatStamp(iso: string | null): string {
  if (iso === null) return 'Not synced yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not synced yet';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function BlogScreen({ navigation }: Props) {
  const { posts, source, loading, error, refresh } = useBlogPosts();
  const { packages } = useCatalog();
  const { colors, fs, settings, t } = useSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [section, setSection] = useState<Section>('feed');
  const [saved, setSaved] = useState<SavedArticleBody[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [followExpanded, setFollowExpanded] = useState(false);
  const [hubTitle, setHubTitle] = useState<string | null>(null);
  const [feedStamp, setFeedStamp] = useState<string | null>(null);

  // Restore the autosaved search + category once, on mount.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const draft = await loadBlogSearchDraft();
      const stamp = await readBlogCacheStamp();
      if (!alive) return;
      if (draft !== null) {
        setQuery(draft.query);
        setCategory(draft.category);
      }
      setFeedStamp(stamp);
      setDraftLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Autosave on every change (never memory-only).
  useEffect(() => {
    if (!draftLoaded) return;
    void saveBlogSearchDraft({ query, category });
  }, [query, category, draftLoaded]);

  // Refresh the saved list + followed set whenever the saved section
  // is opened.
  useEffect(() => {
    if (section !== 'saved') return;
    void (async () => {
      const [s, f] = await Promise.all([
        listSavedArticleBodies(),
        listFollowedCategories(),
      ]);
      setSaved(s);
      setFollowed(f);
    })();
  }, [section]);

  // Followed set is also needed for the feed's follow row.
  useEffect(() => {
    void listFollowedCategories().then(setFollowed);
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(posts.map((p) => p.category).filter((c) => c !== '')),
      ),
    [posts],
  );

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (category === null || p.category === category) &&
          matchesQuery(p, query),
      ),
    [posts, category, query],
  );

  const filterActive = category !== null || query.trim() !== '';

  // Reset for the filtered-empty state: clear the in-memory filter AND
  // the autosaved draft, so the filter cannot silently restore on the
  // next mount (the restored "Travel Tips" chip seen on the phone).
  // Reuses the established saveBlogSearchDraft pattern with empty
  // values; no new drafts.ts helper is needed.
  function handleShowAllPosts() {
    setQuery('');
    setCategory(null);
    void saveBlogSearchDraft({ query: '', category: null });
  }

  const hubs = useMemo(
    () => buildDestinationHubs(packages, posts),
    [packages, posts],
  );
  const activeHub = hubs.find((h) => h.title === hubTitle) ?? null;

  const sourceLabel =
    source === 'live'
      ? 'Live blog feed'
      : source === 'cache'
        ? 'Saved blog posts (offline)'
        : 'Blog feed';

  const sectionButton = (key: Section, label: string) => (
    <Pressable
      key={key}
      style={[
        styles.sectionButton,
        {
          borderColor: section === key ? colors.primary : colors.border,
          backgroundColor: section === key ? colors.primary : colors.background,
        },
      ]}
      onPress={() => {
        setSection(key);
        setHubTitle(null);
      }}>
      <Text
        style={[
          styles.sectionButtonText,
          { color: section === key ? '#FFFFFF' : colors.text },
        ]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>Blog</Text>
        <Text style={[styles.source, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          {sourceLabel}
          {settings.dataSaver ? ' · Low-data mode: text-only list' : ''}
        </Text>
      </View>
      <View style={styles.sectionRow}>
        {sectionButton('feed', 'All posts')}
        {sectionButton('saved', 'Saved offline')}
        {sectionButton('hubs', 'Guides')}
        {sectionButton('videos', 'Videos')}
      </View>

      {section === 'videos' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.centerTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
            Video guides
          </Text>
          <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            {VIDEO_GUIDES_EMPTY_MESSAGE}
          </Text>
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => navigation.navigate('BlogVideoGuides')}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open video guides</Text>
          </Pressable>
        </ScrollView>
      ) : section === 'saved' ? (
        <FlatList
          style={{ flex: 1 }}
          data={saved}
          ListFooterComponent={
            <Pressable
              style={[styles.button, styles.outlineButton]}
              onPress={() => navigation.navigate('BlogLibrary')}>
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open my library</Text>
            </Pressable>
          }
          keyExtractor={(a) => a.slug}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                Nothing saved yet. Open an article and tap “Save offline”
                to read it without a connection.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() =>
                navigation.navigate('BlogArticle', {
                  slug: item.slug,
                  title: item.title,
                })
              }>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.heading) }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.category !== '' ? (
                <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>{item.category}</Text>
              ) : null}
              <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                Saved for offline reading
              </Text>
            </Pressable>
          )}
        />
      ) : section === 'hubs' && activeHub === null ? (
        <FlatList
          style={{ flex: 1 }}
          data={hubs}
          keyExtractor={(h) => h.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                No destination guides available yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => setHubTitle(item.title)}>
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
      ) : section === 'hubs' && activeHub !== null ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => setHubTitle(null)}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>← All guides</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
            {activeHub.title}
          </Text>
          <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Packages
          </Text>
          {activeHub.packages.length === 0 ? (
            <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              No packages in this category yet.
            </Text>
          ) : (
            activeHub.packages.map((p) => (
              <Pressable
                key={p.slug}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => navigation.navigate('PackageDetail', { slug: p.slug })}>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]} numberOfLines={2}>
                  {p.title}
                </Text>
              </Pressable>
            ))
          )}
          <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Articles
          </Text>
          {activeHub.articles.length === 0 ? (
            <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              No articles in this category yet.
            </Text>
          ) : (
            activeHub.articles.map((a) => (
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
          <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            FAQs live in the Chat tab. For anything specific, ask the team.
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
                `Hi My Quick Trippers! I have a question about ${activeHub.title}.`,
              )
            }>
            <Text style={styles.buttonText}>WhatsApp the team</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(p) => p.slug}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.searchWrap}>
                <TextInput
                  style={[styles.search, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Search blog posts…"
                  placeholderTextColor={colors.placeholderText}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
              </View>
              {categories.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}>
                  <Pressable
                    style={[
                      styles.chip,
                      {
                        borderColor: category === null ? colors.primary : colors.border,
                        backgroundColor: category === null ? colors.primary : colors.background,
                      },
                    ]}
                    onPress={() => setCategory(null)}>
                    <Text style={[styles.chipText, { color: category === null ? '#FFFFFF' : colors.text }]}>
                      All
                    </Text>
                  </Pressable>
                  {categories.map((c) => (
                    <Pressable
                      key={c}
                      style={[
                        styles.chip,
                        {
                          borderColor: category === c ? colors.primary : colors.border,
                          backgroundColor: category === c ? colors.primary : colors.background,
                        },
                      ]}
                      onPress={() => setCategory(c)}>
                      <Text style={[styles.chipText, { color: category === c ? '#FFFFFF' : colors.text }]}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {categories.length > 0 ? (
                <View style={styles.followWrap}>
                  <Pressable
                    style={[styles.followToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
                    onPress={() => setFollowExpanded((v) => !v)}>
                    <Text style={[styles.followToggleText, { color: colors.text, fontSize: fs(FONT.body) }]}>
                      Follow categories for alerts
                    </Text>
                    <Text style={[styles.followToggleChevron, { color: colors.muted }]}>
                      {followExpanded ? '▾' : '▸'}
                    </Text>
                  </Pressable>
                  {followExpanded ? (
                    <View>
                      <Text style={[styles.followLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                        Follow a category for new-guide alerts (in-app only, no push):
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipScroll}>
                        {categories.map((c) => {
                          const isFollowed = followed.includes(c);
                          return (
                            <Pressable
                              key={`follow-${c}`}
                              style={[
                                styles.chip,
                                {
                                  borderColor: isFollowed ? colors.primary : colors.border,
                                  backgroundColor: isFollowed ? colors.primary : colors.background,
                                },
                              ]}
                              onPress={() => {
                                void toggleFollowedCategory(c).then((now) => {
                                  setFollowed((prev) =>
                                    now ? [...prev, c] : prev.filter((x) => x !== c),
                                  );
                                });
                              }}>
                              <Text style={[styles.chipText, { color: isFollowed ? '#FFFFFF' : colors.text }]}>
                                {isFollowed ? `✓ ${c}` : `Follow ${c}`}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      <View style={styles.followActionWrap}>
                        <Pressable
                          style={[styles.button, styles.outlineButton, styles.followCheckButton]}
                          onPress={() => {
                            void checkNewBlogPosts(posts).then((r) => {
                              setCheckResult(
                                r.created > 0
                                  ? `${r.created} new guide${r.created === 1 ? '' : 's'} added to your notification centre.`
                                  : 'No new guides in your followed categories.',
                              );
                            });
                          }}>
                          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
                            Check for new guides
                          </Text>
                        </Pressable>
                        {checkResult !== null ? (
                          <Text style={[styles.followLabel, styles.followResult, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                            {checkResult}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            loading && posts.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>{t('loading')}</Text>
              </View>
            ) : error !== null && posts.length === 0 ? (
              <View style={styles.center}>
                <Text style={[styles.centerTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                  Could not load blog posts
                </Text>
                <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                  {error.message}
                </Text>
                <Pressable style={[styles.button, styles.primaryButton]} onPress={refresh}>
                  <Text style={styles.buttonText}>{t('retry')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.whatsappButton]}
                  onPress={() =>
                    whatsappAction('Hi My Quick Trippers! The blog is not loading in the app. Could you share the latest guides?')
                  }>
                  <Text style={styles.buttonText}>Try WhatsApp instead</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.outlineButton]}
                  onPress={() => Linking.openURL(BLOG_URL)}>
                  <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open in browser</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={[styles.centerText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                  No blog posts match your search.
                </Text>
                {filterActive ? (
                  <Pressable
                    style={[styles.button, styles.primaryButton]}
                    onPress={handleShowAllPosts}>
                    <Text style={styles.buttonText}>Show all posts</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.button, styles.outlineButton]}
                  onPress={() => Linking.openURL(BLOG_URL)}>
                  <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open in browser</Text>
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={
            filtered.length > 0 ? (
              <View style={styles.footerNote}>
                <Text style={[styles.footerText, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                  Blog feed last updated: {formatStamp(feedStamp)}
                  {error !== null ? ' · Showing saved posts — pull to refresh to try again.' : ''}
                </Text>
                <Pressable
                  style={[styles.button, styles.outlineButton]}
                  onPress={() => Linking.openURL(BLOG_URL)}>
                  <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open in browser</Text>
                </Pressable>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() =>
                navigation.navigate('BlogArticle', {
                  slug: item.slug,
                  title: item.title,
                })
              }>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.heading) }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.category !== '' ? (
                <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>{item.category}</Text>
              ) : null}
              {item.excerpt !== '' ? (
                <Text style={[styles.cardExcerpt, { color: colors.muted, fontSize: fs(FONT.body) }]} numberOfLines={3}>
                  {item.excerpt}
                </Text>
              ) : null}
              {item.publishedAt !== '' ? (
                <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                  {new Date(item.publishedAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontWeight: WEIGHT.bold },
  source: { marginTop: SPACING.xs },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  sectionButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.md,
  },
  sectionButtonText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  searchWrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  search: {
    height: TOUCH_MIN,
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: 14,
    fontSize: FONT.body,
  },
  chipScroll: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.md,
  },
  chipText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  followWrap: { paddingTop: SPACING.sm },
  followToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  followToggleText: { fontWeight: WEIGHT.bold },
  followToggleChevron: { fontSize: 20 },
  followActionWrap: { paddingHorizontal: SPACING.lg },
  followCheckButton: { marginTop: SPACING.md },
  followResult: { paddingHorizontal: 0 },
  followLabel: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, lineHeight: 18 },
  list: { padding: SPACING.lg, gap: SPACING.md, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.lg },
  cardTitle: { fontWeight: WEIGHT.bold },
  cardMeta: { marginTop: SPACING.xs },
  cardExcerpt: { marginTop: SPACING.sm, lineHeight: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  centerTitle: { fontWeight: WEIGHT.bold, textAlign: 'center' },
  centerText: { marginTop: SPACING.sm, textAlign: 'center', lineHeight: 22 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  primaryButton: { backgroundColor: '#127C82' },
  whatsappButton: { backgroundColor: '#25D366' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
  footerNote: { alignItems: 'center', paddingTop: SPACING.lg },
  footerText: { textAlign: 'center' },
});
