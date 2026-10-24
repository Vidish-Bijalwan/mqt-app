/**
 * Blog library (v2, items 93 / 96 / 97 / 98).
 *
 * Device-local reading library: saved offline articles, bookmarks,
 * reading history, followed-category toggles + new-guide check, and
 * the honest video-guides empty state. Nothing here is fetched from a
 * new backend: saved/bookmarked/history entries come only from the
 * real blog feed the user actually opened. Tapping an entry opens the
 * existing BlogArticle screen (coordinator wires this screen into the
 * stack; navigation is cast through the generic navigator until then).
 *
 * "Check for new guides" posts IN-APP centre entries only — no push
 * notification is sent (no backend exists to send one).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { useBlogPosts } from '../lib/blog';
import type { SavedArticleBody } from '../lib/blog';
import {
  checkNewBlogPosts,
  clearBookmarks,
  clearReadingData,
  clearReadingHistory,
  listBookmarks,
  listFollowedCategories,
  listReadingHistory,
  listSavedArticleBodies,
  toggleFollowedCategory,
  VIDEO_GUIDES_EMPTY_MESSAGE,
} from '../lib/reading';
import type { BookmarkEntry, HistoryEntry } from '../lib/reading';

type AppNavigate = {
  navigate: (name: string, params?: Record<string, unknown>) => void;
};

export function BlogLibraryScreen() {
  const navigation = useNavigation() as unknown as AppNavigate;
  const { colors, fs } = useSettings();
  const { posts } = useBlogPosts();
  const [saved, setSaved] = useState<SavedArticleBody[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const reload = useCallback(() => {
    void (async () => {
      const [s, b, h, f] = await Promise.all([
        listSavedArticleBodies(),
        listBookmarks(),
        listReadingHistory(),
        listFollowedCategories(),
      ]);
      setSaved(s);
      setBookmarks(b);
      setHistory(h);
      setFollowed(f);
    })();
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openArticle = useCallback(
    (slug: string, title: string) => {
      navigation.navigate('BlogArticle', { slug, title });
    },
    [navigation],
  );

  const categories = Array.from(
    new Set(posts.map((p) => p.category).filter((c) => c !== '')),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          My library
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Saved articles work offline. Bookmarks and history stay on this
          device only.
        </Text>

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Saved for offline reading
        </Text>
        {saved.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Nothing saved yet. Open an article and tap “Save offline”.
          </Text>
        ) : (
          saved.map((a) => (
            <Pressable
              key={a.slug}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => openArticle(a.slug, a.title)}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {a.title}
              </Text>
              {a.category !== '' ? (
                <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                  {a.category}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Bookmarks
        </Text>
        {bookmarks.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No bookmarks yet.
          </Text>
        ) : (
          bookmarks.map((b) => (
            <Pressable
              key={b.slug}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => openArticle(b.slug, b.title)}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {b.title}
              </Text>
            </Pressable>
          ))
        )}
        {bookmarks.length > 0 ? (
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => {
              void clearBookmarks().then(reload);
            }}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              Clear bookmarks
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Reading history
        </Text>
        {history.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No articles read yet.
          </Text>
        ) : (
          history.map((h) => (
            <Pressable
              key={h.slug}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => openArticle(h.slug, h.title)}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {h.title}
              </Text>
            </Pressable>
          ))
        )}
        {history.length > 0 ? (
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => {
              void clearReadingHistory().then(reload);
            }}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              Clear history
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Followed categories
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          New guides in followed categories appear as in-app alerts in
          the notification centre. No push notifications are sent.
        </Text>
        <View style={styles.chipRow}>
          {categories.map((c) => {
            const isFollowed = followed.includes(c);
            return (
              <Pressable
                key={c}
                style={[
                  styles.chip,
                  {
                    borderColor: isFollowed ? colors.primary : colors.border,
                    backgroundColor: isFollowed ? colors.primary : colors.background,
                  },
                ]}
                onPress={() => {
                  void toggleFollowedCategory(c).then(reload);
                }}>
                <Text
                  style={[
                    styles.chipText,
                    { color: isFollowed ? '#FFFFFF' : colors.text },
                  ]}>
                  {isFollowed ? `✓ ${c}` : c}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => {
            void checkNewBlogPosts(posts).then((r) => {
              setCheckResult(
                r.created > 0
                  ? `${r.created} new guide${r.created === 1 ? '' : 's'} added to your notification centre.`
                  : 'No new guides in your followed categories.',
              );
            });
          }}>
          <Text style={styles.buttonText}>Check for new guides</Text>
        </Pressable>
        {checkResult !== null ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            {checkResult}
          </Text>
        ) : null}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Video guides
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          {VIDEO_GUIDES_EMPTY_MESSAGE}
        </Text>

        <Pressable
          style={[styles.button, styles.outlineButton]}
          onPress={() => {
            void clearReadingData().then(reload);
          }}>
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
            Clear all reading data
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
  note: { marginTop: SPACING.sm, lineHeight: 22 },
  heading: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.md, marginTop: SPACING.sm },
  cardTitle: { fontWeight: WEIGHT.bold },
  cardMeta: { marginTop: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.md,
  },
  chipText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  primaryButton: { backgroundColor: '#127C82' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
});
