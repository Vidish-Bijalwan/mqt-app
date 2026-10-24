/**
 * Blog reading data (v2, Category J remainder: items 93–100).
 *
 * Device-local only (AsyncStorage, '@mqt/...' keys). Nothing here is
 * sent anywhere and no content is invented:
 * - Saved articles reuse the verbatim bodies in lib/blog.ts.
 * - Bookmarks/history store only slug + title from the real feed.
 * - Related articles are same-category posts from the real feed.
 * - Package links are created ONLY on a verifiable catalogue-slug
 *   match (see findPackageLinks) — never guessed from keywords.
 * - Video guides: there is NO video feed, video route, or video asset
 *   in the repo or the blog feed, so the list is honestly empty.
 *   Never stock footage presented as MQT videos.
 * - Blog notifications are IN-APP centre entries only (no push
 *   sending: no backend exists). They are gated by followed categories.
 *   LIMIT: lib/notifications.ts has no 'blog' kind and no BlogArticle
 *   deep link, so entries use kind 'reminder' with no deep link — the
 *   centre entry names the article and the user opens it from Blog.
 *   A coordinator note flags adding a real blog kind/link upstream.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listSavedArticleBodies,
  readSavedArticleBody,
  removeSavedArticleBody,
  saveArticleBody,
} from './blog';
import type { ArticleBody, BlogPost, SavedArticleBody } from './blog';
import { addCenterEntry } from './notifications';
import type { CatalogPackage } from './catalog';

export const BOOKMARKS_KEY = '@mqt/blog-bookmarks';
export const READING_HISTORY_KEY = '@mqt/blog-history';
export const FOLLOWED_CATEGORIES_KEY = '@mqt/blog-followed-categories';
export const BLOG_SEEN_SLUGS_KEY = '@mqt/blog-seen-slugs';

const MAX_HISTORY = 100;

/* ------------------------------ helpers --------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function readStringList(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is string => typeof s === 'string' && s !== '',
    );
  } catch {
    return [];
  }
}

/* ------------------------- saved articles (93) -------------------------- */

export { saveArticleBody, listSavedArticleBodies, readSavedArticleBody, removeSavedArticleBody };
export type { SavedArticleBody };

export async function isArticleSaved(slug: string): Promise<boolean> {
  return (await readSavedArticleBody(slug)) !== null;
}

/** Save a live article body for offline reading; no-op for null bodies. */
export async function saveArticleForOffline(
  article: ArticleBody | null,
): Promise<boolean> {
  if (article === null) return false;
  await saveArticleBody(article);
  return true;
}

/* --------------------- bookmarks + history (96) ------------------------- */

export interface BookmarkEntry {
  slug: string;
  title: string;
}

function validateBookmark(raw: unknown): BookmarkEntry | null {
  if (!isRecord(raw)) return null;
  const slug = asString(raw.slug).trim();
  const title = asString(raw.title).trim();
  if (slug === '' || title === '') return null;
  return { slug, title };
}

export async function listBookmarks(): Promise<BookmarkEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateBookmark)
      .filter((b): b is BookmarkEntry => b !== null);
  } catch {
    return [];
  }
}

/** Toggle a bookmark; returns true when the article is now bookmarked. */
export async function toggleBookmark(post: {
  slug: string;
  title: string;
}): Promise<boolean> {
  const existing = await listBookmarks();
  const found = existing.some((b) => b.slug === post.slug);
  const next = found
    ? existing.filter((b) => b.slug !== post.slug)
    : [{ slug: post.slug, title: post.title }, ...existing];
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return !found;
}

export async function isBookmarked(slug: string): Promise<boolean> {
  return (await listBookmarks()).some((b) => b.slug === slug);
}

export async function clearBookmarks(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BOOKMARKS_KEY);
  } catch {
    // Best-effort only.
  }
}

export interface HistoryEntry {
  slug: string;
  title: string;
  viewedAt: string;
}

function validateHistory(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw)) return null;
  const slug = asString(raw.slug).trim();
  const title = asString(raw.title).trim();
  const viewedAt = asString(raw.viewedAt);
  if (slug === '' || title === '' || viewedAt === '') return null;
  return { slug, title, viewedAt };
}

export async function recordArticleView(post: {
  slug: string;
  title: string;
}): Promise<void> {
  try {
    const existing = await listReadingHistory();
    const rest = existing.filter((h) => h.slug !== post.slug);
    const next: HistoryEntry[] = [
      { slug: post.slug, title: post.title, viewedAt: new Date().toISOString() },
      ...rest,
    ].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(READING_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
}

export async function listReadingHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(READING_HISTORY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateHistory)
      .filter((h): h is HistoryEntry => h !== null);
  } catch {
    return [];
  }
}

export async function clearReadingHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(READING_HISTORY_KEY);
  } catch {
    // Best-effort only.
  }
}

/** Clear bookmarks + history + saved articles (library "clear all"). */
export async function clearReadingData(): Promise<void> {
  await Promise.all([
    clearBookmarks(),
    clearReadingHistory(),
    (async () => {
      const saved = await listSavedArticleBodies();
      for (const a of saved) await removeSavedArticleBody(a.slug);
    })(),
  ]);
}

/* ------------------- followed categories + alerts (97) ------------------ */

export async function listFollowedCategories(): Promise<string[]> {
  return readStringList(FOLLOWED_CATEGORIES_KEY);
}

/** Toggle a followed category; returns true when now followed. */
export async function toggleFollowedCategory(
  category: string,
): Promise<boolean> {
  if (category === '') return false;
  const existing = await listFollowedCategories();
  const found = existing.includes(category);
  const next = found
    ? existing.filter((c) => c !== category)
    : [...existing, category];
  try {
    await AsyncStorage.setItem(FOLLOWED_CATEGORIES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return !found;
}

export async function isCategoryFollowed(category: string): Promise<boolean> {
  return (await listFollowedCategories()).includes(category);
}

/** Pure filter: genuinely new = slug never seen AND category followed. */
export function detectNewBlogPosts(
  livePosts: BlogPost[],
  followedCategories: string[],
  seenSlugs: string[],
): BlogPost[] {
  if (followedCategories.length === 0) return [];
  const seen = new Set(seenSlugs);
  return livePosts.filter(
    (p) => !seen.has(p.slug) && followedCategories.includes(p.category),
  );
}

export interface BlogNotificationResult {
  /** Centre entries created (in-app only — no push is sent). */
  created: number;
  /** New posts found, whether or not an entry was created. */
  newPosts: BlogPost[];
}

/**
 * Compare a live feed against the stored seen-slug set and post one
 * in-app centre entry per genuinely new post in a followed category.
 * The seen set always advances to the live feed afterwards, so a post
 * alerts at most once. When nothing is followed, nothing is posted —
 * following nothing means no blog alerts. No push notification is sent
 * by this function (no backend exists to send one).
 */
export async function checkNewBlogPosts(
  livePosts: BlogPost[],
): Promise<BlogNotificationResult> {
  const [followed, seen] = await Promise.all([
    listFollowedCategories(),
    readStringList(BLOG_SEEN_SLUGS_KEY),
  ]);
  const fresh = detectNewBlogPosts(livePosts, followed, seen);
  for (const post of fresh) {
    await addCenterEntry({
      kind: 'reminder',
      title: `New blog guide: ${post.title}`,
      body:
        `A new guide in ${post.category || 'the blog'} is available. ` +
        'Open the Blog tab to read it. (In-app alert only — no push is sent.)',
    });
  }
  try {
    const merged = Array.from(
      new Set([...seen, ...livePosts.map((p) => p.slug)]),
    );
    await AsyncStorage.setItem(BLOG_SEEN_SLUGS_KEY, JSON.stringify(merged));
  } catch {
    // Best-effort only.
  }
  return { created: fresh.length, newPosts: fresh };
}

/* ----------------- related articles + package links (94) ---------------- */

export function relatedArticles(
  posts: BlogPost[],
  currentSlug: string,
  currentCategory: string,
  limit = 6,
): BlogPost[] {
  if (currentCategory === '') return [];
  return posts
    .filter((p) => p.slug !== currentSlug && p.category === currentCategory)
    .slice(0, limit);
}

/** Normalise a slug for comparison: lowercase, non-alphanumerics → '-'. */
export function normaliseSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const GENERIC_SUFFIXES = [
  '-tour-packages',
  '-tour-package',
  '-packages',
  '-package',
  '-tours',
  '-tour',
];

function stripGenericSuffix(slug: string): string {
  let out = slug;
  for (const suffix of GENERIC_SUFFIXES) {
    if (out.endsWith(suffix) && out.length > suffix.length) {
      out = out.slice(0, -suffix.length);
      break;
    }
  }
  return out;
}

/**
 * Verifiable package links only. A catalogue package links from an
 * article when, after normalisation, EITHER the slugs are equal OR the
 * slugs are equal after stripping one generic suffix ('-tour-packages',
 * '-package', …) from the package slug. Article titles are NOT used to
 * guess links: a title keyword match is not a verified catalogue link.
 * Returns [] (not a guessed link) when nothing matches exactly.
 */
export function findPackageLinks(
  article: { slug: string },
  packages: CatalogPackage[],
): CatalogPackage[] {
  const articleSlug = normaliseSlug(article.slug);
  if (articleSlug === '') return [];
  return packages.filter((pkg) => {
    const pkgSlug = normaliseSlug(pkg.slug);
    if (pkgSlug === '') return false;
    return pkgSlug === articleSlug || stripGenericSuffix(pkgSlug) === articleSlug;
  });
}

/* ------------------------- video guides (98) ---------------------------- */

export interface VideoGuide {
  title: string;
  url: string;
}

/** Honest empty state: no MQT video feed, route, or asset exists in
 *  the repo or the blog feed today (verified by search over src/ and
 *  assets/). This list stays empty until the team publishes real
 *  videos — stock footage is never presented as MQT videos. */
export const VIDEO_GUIDES: VideoGuide[] = [];

export const VIDEO_GUIDES_EMPTY_MESSAGE =
  'No video guides published yet. Video guides will appear here when My Quick Trippers publishes them.';

export function listVideoGuides(): VideoGuide[] {
  return VIDEO_GUIDES;
}

/* ---------------------- destination guide hubs (99) --------------------- */

export interface DestinationHub {
  /** Slugified category, used as the hub id / route param. */
  id: string;
  /** Category name as it appears in the catalogue/feed. */
  title: string;
  packages: CatalogPackage[];
  articles: BlogPost[];
}

/**
 * One hub per category present in the catalogue or the feed. Hub
 * packages are the catalogue entries in that category; hub articles
 * are the feed posts in that same category. Categories that match in
 * only one source still get a hub (with the other side empty, shown
 * honestly) — no cross-category guessing. FAQ content is NOT
 * duplicated here: the app's only FAQ copy lives in the Chat tab
 * (ChatScreen, not a shared module), so hubs link to the Chat tab's
 * FAQ section and to call/WhatsApp instead of inventing FAQ text.
 */
export function buildDestinationHubs(
  packages: CatalogPackage[],
  posts: BlogPost[],
): DestinationHub[] {
  const titles = new Set<string>();
  for (const p of packages) if (p.category !== '') titles.add(p.category);
  for (const p of posts) if (p.category !== '') titles.add(p.category);
  return Array.from(titles)
    .sort((a, b) => a.localeCompare(b))
    .map((title) => ({
      id: normaliseSlug(title),
      title,
      packages: packages.filter((p) => p.category === title),
      articles: posts.filter((p) => p.category === title),
    }));
}
