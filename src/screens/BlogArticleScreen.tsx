/**
 * Blog article (v1.3, item 92 — native article renderer).
 *
 * When the site's read-only article route serves a real body
 * (GET /api/blog/posts/{slug}: factory seed blocks, or CMS markdown),
 * the article renders NATIVELY: title, cover, meta, body as structured
 * text sections, reading progress, font-size control (the settings
 * fontScale), and night mode (the settings theme).
 *
 * When no real body is available through any feed (bodyKind null, or
 * the route fails), the screen renders ONLY what the feed honestly
 * provides — title, excerpt, cover, category, date — and keeps the
 * WebView/browser for the full article. No article text is ever
 * invented, summarised, or paraphrased here.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { RootStackParamList } from '../navigation/types';
import {
  fetchArticleBodyWithOfflineFallback,
  fetchBlogPosts,
  markdownToSections,
  readCachedBlogPosts,
  stripMarkdownInline,
} from '../lib/blog';
import type {
  ArticleBlock,
  ArticleBody,
  ArticleLoadSource,
  BlogPost,
} from '../lib/blog';
import { readCachedCatalog } from '../lib/catalog';
import type { CatalogPackage } from '../lib/catalog';
import { packages as bundledPackages } from '../data/packages';
import {
  findPackageLinks,
  isArticleSaved,
  isBookmarked,
  recordArticleView,
  relatedArticles,
  saveArticleForOffline,
  toggleBookmark,
} from '../lib/reading';
import { blogCoverUrl } from '../lib/lowdata';
import { logError } from '../lib/errorlog';
import { retryWithBackoff } from '../lib/retry';
import { whatsappAction } from '../lib/contact';

type Props = NativeStackScreenProps<RootStackParamList, 'BlogArticle'>;

const FONT_SCALES = [0.85, 1, 1.15, 1.3] as const;

function formatDate(iso: string): string {
  if (iso === '') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Native rendering of one structured block. Unknown block types
 *  render their text/items when present, and nothing otherwise — the
 *  site's content is never reinterpreted into new claims. */
function ArticleBlockView({
  block,
  colors,
  fs,
}: {
  block: ArticleBlock;
  colors: { text: string; muted: string; border: string; card: string };
  fs: (base: number) => number;
}) {
  switch (block.type) {
    case 'h2':
      return (
        <Text style={[styles.h2, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {stripMarkdownInline(block.text ?? '')}
        </Text>
      );
    case 'h3':
      return (
        <Text style={[styles.h3, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {stripMarkdownInline(block.text ?? '')}
        </Text>
      );
    case 'ul':
    case 'ol':
      return (
        <View style={styles.list}>
          {(block.items ?? []).map((item, i) => (
            <Text
              key={i}
              style={[styles.listItem, { color: colors.text, fontSize: fs(FONT.body) }]}>
              {'•  '}
              {stripMarkdownInline(item)}
            </Text>
          ))}
        </View>
      );
    case 'cardGrid':
      return (
        <View style={styles.grid}>
          {(block.cards ?? []).map((card, i) => (
            <View
              key={i}
              style={[styles.gridCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.gridTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {card.title}
              </Text>
              {card.note ? (
                <Text style={[styles.gridNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                  {card.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      );
    case 'changeGrid':
      return (
        <View style={styles.grid}>
          {(block.changes ?? []).map((change, i) => (
            <View
              key={i}
              style={[styles.gridCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.gridTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {change.title}
              </Text>
              <Text style={[styles.gridNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                Before: {change.before}
              </Text>
              <Text style={[styles.gridNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                After: {change.after}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'video':
      // Video blocks carry only an attribution (site policy: never
      // present a video as the site's own). The native renderer shows
      // the attribution and links out; playback stays on the site.
      return block.title ? (
        <Text style={[styles.videoNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Video: {block.title}
        </Text>
      ) : null;
    case 'p':
    default: {
      const text = stripMarkdownInline(block.text ?? '');
      if (text === '' && (block.items ?? []).length === 0) return null;
      if (text !== '') {
        return (
          <Text style={[styles.paragraph, { color: colors.text, fontSize: fs(FONT.body) }]}>
            {text}
          </Text>
        );
      }
      return (
        <View style={styles.list}>
          {(block.items ?? []).map((item, i) => (
            <Text
              key={i}
              style={[styles.listItem, { color: colors.text, fontSize: fs(FONT.body) }]}>
              {'•  '}
              {stripMarkdownInline(item)}
            </Text>
          ))}
        </View>
      );
    }
  }
}

export function BlogArticleScreen({ route, navigation }: Props) {
  const { slug, title } = route.params;
  const { colors, fs, settings, updateSettings, t } = useSettings();
  const [article, setArticle] = useState<ArticleBody | null>(null);
  const [loadSource, setLoadSource] = useState<ArticleLoadSource>('none');
  const [loading, setLoading] = useState(true);
  const [webFailed, setWebFailed] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showFullInBrowser, setShowFullInBrowser] = useState(false);
  // v2: offline save / bookmark state, related articles (same-category
  // posts from the real feed) and package links (verified slug matches
  // only — see findPackageLinks; [] when nothing matches exactly).
  const [isSaved, setIsSaved] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [packageLinks, setPackageLinks] = useState<CatalogPackage[]>([]);
  const scrollMetrics = useRef({ offset: 0, visible: 1, total: 1 });

  const url = `https://www.myquicktrippers.com/blog/${slug}`;

  useEffect(() => {
    let alive = true;
    fetchArticleBodyWithOfflineFallback(slug).then(({ article: body, source }) => {
      if (!alive) return;
      setArticle(body);
      setLoadSource(source);
      setLoading(false);
      if (body === null) {
        void logError('blog-article', `No live or saved body for ${slug}`);
        return;
      }
      // Reading history (device-local) + bookmark/saved state.
      void recordArticleView({ slug: body.slug, title: body.title });
      void isBookmarked(body.slug).then((v) => {
        if (alive) setBookmarked(v);
      });
      void isArticleSaved(body.slug).then((v) => {
        if (alive) setIsSaved(v);
      });
      // Related + package links from the real feed/catalogue.
      void (async () => {
        let feed: BlogPost[] | null = null;
        try {
          // Smart retry (154): one retry before falling back to cache.
          feed = await retryWithBackoff(() => fetchBlogPosts(), {
            attempts: 2,
            delayMs: 500,
          });
        } catch {
          feed = await readCachedBlogPosts();
        }
        const cachedCatalog = await readCachedCatalog();
        const catalogue: CatalogPackage[] =
          cachedCatalog !== null
            ? cachedCatalog.packages
            : (bundledPackages as CatalogPackage[]);
        if (!alive) return;
        if (feed !== null) {
          setRelated(relatedArticles(feed, body.slug, body.category));
        }
        setPackageLinks(findPackageLinks(body, catalogue));
      })();
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  const updateProgress = useCallback(() => {
    const { offset, visible, total } = scrollMetrics.current;
    const max = Math.max(total - visible, 1);
    setProgress(Math.min(1, Math.max(0, offset / max)));
  }, []);

  const cycleFontScale = useCallback(
    (dir: 1 | -1) => {
      const idx = FONT_SCALES.indexOf(settings.fontScale);
      const next =
        FONT_SCALES[
          Math.min(
            FONT_SCALES.length - 1,
            Math.max(0, (idx < 0 ? 1 : idx) + dir),
          )
        ];
      updateSettings({ fontScale: next });
    },
    [settings.fontScale, updateSettings],
  );

  const toggleNightMode = useCallback(() => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }, [settings.theme, updateSettings]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  const hasNativeBody =
    article !== null &&
    ((article.bodyKind === 'blocks' && article.blocks.length > 0) ||
      (article.bodyKind === 'markdown' && article.bodyMd.trim() !== ''));
  const sections: ArticleBlock[] = hasNativeBody
    ? article.bodyKind === 'markdown'
      ? markdownToSections(article.bodyMd)
      : article.blocks
    : [];
  const cover =
    article !== null ? blogCoverUrl(article.coverImage, settings.dataSaver) : '';
  const displayTitle = article !== null ? article.title : title;

  // Explicit "open on website" from the native toolbar (native only;
  // on web the toolbar button opens the URL directly).
  if (showFullInBrowser) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.heading) }]} numberOfLines={3}>
          {displayTitle}
        </Text>
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Read the full article with its original formatting on the
          My Quick Trippers blog.
        </Text>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => Linking.openURL(url)}>
          <Text style={styles.buttonText}>Open in browser</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.outlineButton]}
          onPress={() => setShowFullInBrowser(false)}>
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Back to native article</Text>
        </Pressable>
      </View>
    );
  }

  // Full-body fallback: no real body from any feed. Show honest
  // metadata natively and keep the WebView (native) / browser (web)
  // for the full article text.
  if (!hasNativeBody) {
    if (Platform.OS === 'web' || showFullInBrowser) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.heading) }]} numberOfLines={3}>
            {displayTitle}
          </Text>
          {article?.excerpt ? (
            <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              {article.excerpt}
            </Text>
          ) : null}
          {article?.category || article?.publishedAt ? (
            <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
              {[article.category, formatDate(article.publishedAt)]
                .filter((s) => s !== '')
                .join(' · ')}
            </Text>
          ) : null}
          <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            The full text of this article is not available in the app
            feed yet — read it on the My Quick Trippers blog.
          </Text>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => Linking.openURL(url)}>
            <Text style={styles.buttonText}>Open in browser</Text>
          </Pressable>
        </View>
      );
    }
    if (webFailed) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.heading) }]}>
            Could not load this article
          </Text>
          <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Please check your connection and try again, or read it in your
            browser.
          </Text>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => {
              setWebFailed(false);
              setWebLoading(true);
            }}>
            <Text style={styles.buttonText}>{t('retry')}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.whatsappButton]}
            onPress={() =>
              whatsappAction(
                `Hi My Quick Trippers! This article is not loading in the app: ${displayTitle}. Could you share it?`,
              )
            }>
            <Text style={styles.buttonText}>Try WhatsApp instead</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => Linking.openURL(url)}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open in browser</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {article !== null ? (
          <View style={styles.fallbackHeader}>
            <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.heading) }]} numberOfLines={3}>
              {displayTitle}
            </Text>
            <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
              Reading the full article on the website — the app feed does
              not carry this article&apos;s text yet.
            </Text>
            <Pressable
              style={[styles.button, styles.outlineButton]}
              onPress={() => {
                void Share.share({
                  title: displayTitle,
                  message: `${displayTitle}\n${url}`,
                });
              }}>
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Share article</Text>
            </Pressable>
          </View>
        ) : null}
        {webLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              {t('loading')}
            </Text>
          </View>
        ) : null}
        <WebView
          source={{ uri: url }}
          onLoadStart={() => setWebLoading(true)}
          onLoadEnd={() => setWebLoading(false)}
          onError={() => {
            setWebLoading(false);
            setWebFailed(true);
          }}
          onHttpError={() => {
            setWebLoading(false);
            setWebFailed(true);
          }}
        />
      </View>
    );
  }

  // Native renderer.
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.articleBody}
        onScroll={(e) => {
          const { contentOffset, layoutMeasurement, contentSize } =
            e.nativeEvent;
          scrollMetrics.current = {
            offset: contentOffset.y,
            visible: layoutMeasurement.height,
            total: contentSize.height,
          };
          updateProgress();
        }}
        scrollEventThrottle={100}>
        <Text style={[styles.articleTitle, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {displayTitle}
        </Text>
        {article.category || article.publishedAt ? (
          <Text style={[styles.meta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
            {[article.category, formatDate(article.publishedAt)]
              .filter((s) => s !== '')
              .join(' · ')}
          </Text>
        ) : null}
        {loadSource === 'saved' ? (
          <Text style={[styles.offlineNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Reading your saved offline copy — the live article could
            not be reached.
          </Text>
        ) : null}
        {settings.language === 'hi' ? (
          <Text style={[styles.offlineNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Hindi version not available — this article is shown exactly
            as published. Article bodies are never machine-translated.
          </Text>
        ) : null}
        {settings.dataSaver ? (
          <Text style={[styles.offlineNote, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Low-data mode: cover image hidden (text-only reading).
          </Text>
        ) : null}
        {cover !== '' && !settings.dataSaver ? (
          <Image
            source={{ uri: cover }}
            style={styles.cover}
            resizeMode="cover"
            accessibilityLabel="Article cover image"
          />
        ) : null}
        {article.excerpt !== '' ? (
          <Text style={[styles.excerpt, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            {article.excerpt}
          </Text>
        ) : null}
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={() => cycleFontScale(-1)}>
            <Text style={[styles.toolText, { color: colors.text }]}>A−</Text>
          </Pressable>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={() => cycleFontScale(1)}>
            <Text style={[styles.toolText, { color: colors.text }]}>A+</Text>
          </Pressable>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={toggleNightMode}>
            <Text style={[styles.toolText, { color: colors.text }]}>
              {settings.theme === 'dark' ? '☀ Light' : '☾ Night'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={() =>
              Platform.OS === 'web'
                ? void Linking.openURL(url)
                : setShowFullInBrowser(true)
            }>
            <Text style={[styles.toolText, { color: colors.primary }]}>
              Open on website
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={() => {
              if (article !== null) {
                void saveArticleForOffline(article).then((ok) => {
                  if (ok) setIsSaved(true);
                });
              }
            }}>
            <Text style={[styles.toolText, { color: colors.text }]}>
              {isSaved ? '✓ Saved offline' : 'Save offline'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={() => {
              if (article !== null) {
                void toggleBookmark({
                  slug: article.slug,
                  title: article.title,
                }).then(setBookmarked);
              }
            }}>
            <Text style={[styles.toolText, { color: colors.text }]}>
              {bookmarked ? '★ Bookmarked' : 'Bookmark'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toolButton, { borderColor: colors.border }]}
            onPress={() => {
              void Share.share({
                title: displayTitle,
                message: `${displayTitle}\n${url}`,
              });
            }}>
            <Text style={[styles.toolText, { color: colors.text }]}>Share</Text>
          </Pressable>
        </View>
        {sections.map((block, i) => (
          <ArticleBlockView
            key={i}
            block={block}
            colors={colors}
            fs={fs}
          />
        ))}
        {packageLinks.length > 0 ? (
          <View style={styles.relatedSection}>
            <Text style={[styles.h2, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Packages mentioned in this article
            </Text>
            <Text style={[styles.paragraph, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              Only packages whose catalogue slug verifiably matches this
              article are linked — no guessed links.
            </Text>
            {packageLinks.map((pkg) => (
              <Pressable
                key={pkg.slug}
                style={[styles.relatedCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => navigation.navigate('PackageDetail', { slug: pkg.slug })}>
                <Text style={[styles.gridTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                  {pkg.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {related.length > 0 ? (
          <View style={styles.relatedSection}>
            <Text style={[styles.h2, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Related articles
            </Text>
            {related.map((post) => (
              <Pressable
                key={post.slug}
                style={[styles.relatedCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() =>
                  navigation.navigate('BlogArticle', { slug: post.slug, title: post.title })
                }>
                <Text style={[styles.gridTitle, { color: colors.text, fontSize: fs(FONT.body) }]} numberOfLines={2}>
                  {post.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={[styles.endNote, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          Article from myquicktrippers.com — rendered natively in the app.
        </Text>
        <Text style={[styles.endNote, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          Some links in articles may be affiliate links: we may earn a small
          commission at no extra cost to you.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loading: { alignItems: 'center', paddingTop: 40 },
  loadingText: { marginTop: SPACING.md },
  title: { fontWeight: WEIGHT.bold, textAlign: 'center' },
  text: { textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22 },
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
  offlineNote: { marginTop: SPACING.sm, lineHeight: 22, fontStyle: 'italic' },
  relatedSection: { marginTop: SPACING.xl },
  relatedCard: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.md, marginTop: SPACING.sm },
  fallbackHeader: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  progressTrack: { height: 4 },
  progressFill: { height: 4, backgroundColor: '#127C82' },
  articleBody: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  articleTitle: { fontWeight: WEIGHT.bold, lineHeight: 30 },
  meta: { marginTop: SPACING.sm },
  cover: { width: '100%', height: 200, borderRadius: RADII.card, marginTop: SPACING.lg },
  excerpt: { marginTop: SPACING.lg, lineHeight: 24, fontStyle: 'italic' },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  toolButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
  },
  toolText: { fontSize: 14, fontWeight: WEIGHT.bold },
  h2: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl, lineHeight: 28 },
  h3: { fontWeight: WEIGHT.bold, marginTop: SPACING.lg, lineHeight: 24 },
  paragraph: { marginTop: SPACING.md, lineHeight: 24 },
  list: { marginTop: SPACING.md },
  listItem: { marginTop: SPACING.sm, lineHeight: 24 },
  grid: { marginTop: SPACING.md, gap: SPACING.sm },
  gridCard: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.md },
  gridTitle: { fontWeight: WEIGHT.bold },
  gridNote: { marginTop: SPACING.sm, lineHeight: 22 },
  videoNote: { marginTop: SPACING.md, lineHeight: 22, fontStyle: 'italic' },
  endNote: { marginTop: SPACING.xl, textAlign: 'center', lineHeight: 20 },
});
