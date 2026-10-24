/**
 * Live blog feed (v1.2 data layer).
 *
 * Fetches the blog post list from the website, caches it on-device, and
 * exposes it through useBlogPosts(). Screens render the list; on failure
 * they show an error state with an "Open in browser" fallback (built by
 * the screen owner, not here).
 *
 * No content is invented: excerpt comes from the API's meta_description,
 * coverImage from cover_image, publishedAt from published_at. Missing
 * optional fields become '' — never guessed text. No PII is logged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, SITE_BASE } from './api';

export const BLOG_STORAGE_KEY = '@mqt/blogposts';
const BLOG_TIMEOUT_MS = 15000;

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: string;
  publishedAt: string;
}

export type BlogSource = 'live' | 'cache' | 'empty';

export interface UseBlogPostsResult {
  posts: BlogPost[];
  source: BlogSource;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

/* --------------------------- defensive parsing -------------------------- */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Map one raw API entry to a BlogPost. Returns null for malformed
 * entries (missing/blank slug or title) — they are dropped, never thrown.
 * API fields: slug, title, meta_description, cover_image, category,
 * tags, target_keyword, published_at, source? (tags / target_keyword /
 * source are not part of BlogPost and are ignored).
 */
export function mapBlogPost(raw: unknown): BlogPost | null {
  if (!isRecord(raw)) return null;
  const slug = asString(raw.slug).trim();
  const title = asString(raw.title).trim();
  if (slug === '' || title === '') return null;
  return {
    slug,
    title,
    excerpt: asString(raw.meta_description),
    coverImage: asString(raw.cover_image),
    category: asString(raw.category),
    publishedAt: asString(raw.published_at),
  };
}

function validateBlogPosts(rawList: unknown): BlogPost[] {
  if (!Array.isArray(rawList)) return [];
  const out: BlogPost[] = [];
  for (const raw of rawList) {
    const post = mapBlogPost(raw);
    if (post !== null) out.push(post);
  }
  return out;
}

/* ------------------------------ caching --------------------------------- */

interface CachedBlog {
  posts: BlogPost[];
  cachedAt: number;
}

/** Best-effort cache write: a storage failure must never fail a fetch. */
async function writeCachedBlogPosts(posts: BlogPost[]): Promise<void> {
  try {
    const payload: CachedBlog = { posts, cachedAt: Date.now() };
    await AsyncStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is best-effort only; the live result is still returned.
  }
}

/**
 * Read the cached post list, re-validating entries on the way out.
 * Returns null when nothing is cached or the cache is unreadable.
 * (An empty cached list is not useful as a fallback, so it reads as null.)
 */
export async function readCachedBlogPosts(): Promise<BlogPost[] | null> {
  try {
    const raw = await AsyncStorage.getItem(BLOG_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.posts)) return null;
    const posts = validateBlogPosts(parsed.posts);
    return posts.length > 0 ? posts : null;
  } catch {
    return null;
  }
}

/* ------------------------------ fetching -------------------------------- */

function userSafeFetchError(status?: number): ApiError {
  if (status === 429) {
    return new ApiError(
      'Too many requests right now. Please try again shortly.',
      status,
    );
  }
  if (status === 502 || status === 503) {
    return new ApiError(
      'The server is temporarily unavailable. Please try again.',
      status,
    );
  }
  if (status !== undefined) {
    return new ApiError('Something went wrong. Please try again.', status);
  }
  return new ApiError(
    'Could not reach the server. Please check your connection and try again.',
  );
}

/**
 * Fetch the live blog feed: GET {SITE_BASE}/api/blog/posts with a 15s
 * timeout (single attempt). On success the validated list is cached to
 * '@mqt/blogposts' and returned. Throws ApiError with a user-safe
 * message on failure; malformed entries are dropped, never thrown.
 * A response whose entries are all malformed is treated as a failure
 * (so the hook can fall back to cache / show an error state) rather
 * than as a genuine empty feed; a genuinely empty posts array is a
 * successful empty result.
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BLOG_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${SITE_BASE}/api/blog/posts`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(
          'The request timed out. Please check your connection and try again.',
        );
      }
      throw userSafeFetchError();
    }
    if (!res.ok) throw userSafeFetchError(res.status);
    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
        res.status,
      );
    }
    if (!isRecord(data) || !Array.isArray(data.posts)) {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
      );
    }
    const posts = validateBlogPosts(data.posts);
    if (data.posts.length > 0 && posts.length === 0) {
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
      );
    }
    await writeCachedBlogPosts(posts);
    return posts;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------- hook ---------------------------------- */

/**
 * Live blog hook.
 *
 * Starts empty, shows the cached list immediately when present
 * (source 'cache'), then fetches live. On success the list is replaced
 * and cached (source 'live'). On failure the cached list is kept when
 * present (source 'cache'), otherwise the list stays empty (source
 * 'empty'), and `error` is set in both failure cases so the screen can
 * show its error state with the "Open in browser" fallback.
 * refresh() forces a refetch.
 */
/**
 * Module-level blog loader. It takes the hook's setters explicitly so
 * the mount effect can call it without tripping
 * react-hooks/set-state-in-effect: that rule inlines component-scope
 * callbacks called from effects and flags their setState calls, even
 * though every setState here runs after an await (cache/network reads).
 * A module-level function is opaque to that analysis, and the loader
 * itself is unchanged behaviourally. The initial useState(true) marks
 * loading on mount; refresh() marks it before re-running the loader.
 */
async function runBlogLoad(args: {
  setPosts: Dispatch<SetStateAction<BlogPost[]>>;
  setSource: Dispatch<SetStateAction<BlogSource>>;
  setError: Dispatch<SetStateAction<ApiError | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  mountedRef: { current: boolean };
}): Promise<void> {
  const { setPosts, setSource, setError, setLoading, mountedRef } = args;
  // Show cache instantly while the live fetch runs.
  const cached = await readCachedBlogPosts();
  if (mountedRef.current && cached !== null) {
    setPosts(cached);
    setSource('cache');
  }
  try {
    const live = await fetchBlogPosts();
    if (!mountedRef.current) return;
    setPosts(live);
    setSource('live');
    setError(null);
  } catch (err) {
    const apiError =
      err instanceof ApiError ? err : userSafeFetchError();
    if (!mountedRef.current) return;
    if (cached !== null) {
      setPosts(cached);
      setSource('cache');
    } else {
      setPosts([]);
      setSource('empty');
    }
    setError(apiError);
  } finally {
    if (mountedRef.current) setLoading(false);
  }
}

export function useBlogPosts(): UseBlogPostsResult {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [source, setSource] = useState<BlogSource>('empty');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void runBlogLoad({
      setPosts,
      setSource,
      setError,
      setLoading,
      mountedRef,
    });
  }, []);

  const refresh = useCallback(() => {
    if (mountedRef.current) setLoading(true);
    void runBlogLoad({
      setPosts,
      setSource,
      setError,
      setLoading,
      mountedRef,
    });
  }, []);

  return { posts, source, loading, error, refresh };
}

/* ------------------------- article body (v1.3) -------------------------- */

/**
 * Native article body (item 92), served verbatim by the site's
 * read-only route GET /api/blog/posts/{slug} (PR #251 branch).
 * - bodyKind 'blocks': factory seed ContentBlocks, served verbatim.
 * - bodyKind 'markdown': CMS body_md, served verbatim.
 * - bodyKind null: no real body is available through any feed — the
 *   screen then renders only the honest metadata (title, excerpt,
 *   cover, category, date) and keeps WebView/browser for the full text.
 * Nothing here is invented: metadata mirrors the list feed, and the
 * body is the site's own content, never rewritten.
 */
export interface ArticleBlock {
  type: string;
  text?: string;
  items?: string[];
  cards?: { title: string; note?: string; badge?: string; tag?: string }[];
  changes?: { title: string; before: string; after: string; note?: string }[];
  title?: string;
}

export interface ArticleBody {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: string;
  publishedAt: string;
  bodyKind: 'blocks' | 'markdown' | null;
  blocks: ArticleBlock[];
  bodyMd: string;
}

function mapArticleBlock(raw: unknown): ArticleBlock | null {
  if (!isRecord(raw)) return null;
  const type = asString(raw.type);
  if (type === '') return null;
  const block: ArticleBlock = { type };
  const text = asString(raw.text);
  if (text !== '') block.text = text;
  if (Array.isArray(raw.items)) {
    const items = raw.items.filter(
      (i): i is string => typeof i === 'string' && i !== '',
    );
    if (items.length > 0) block.items = items;
  }
  if (Array.isArray(raw.cards)) {
    const cards = raw.cards
      .filter(isRecord)
      .map((c) => ({
        title: asString(c.title),
        ...(asString(c.note) !== '' ? { note: asString(c.note) } : {}),
        ...(asString(c.badge) !== '' ? { badge: asString(c.badge) } : {}),
        ...(asString(c.tag) !== '' ? { tag: asString(c.tag) } : {}),
      }))
      .filter((c) => c.title !== '');
    if (cards.length > 0) block.cards = cards;
  }
  if (Array.isArray(raw.changes)) {
    const changes = raw.changes
      .filter(isRecord)
      .map((c) => ({
        title: asString(c.title),
        before: asString(c.before),
        after: asString(c.after),
        ...(asString(c.note) !== '' ? { note: asString(c.note) } : {}),
      }))
      .filter((c) => c.title !== '');
    if (changes.length > 0) block.changes = changes;
  }
  const title = asString(raw.title);
  if (title !== '') block.title = title;
  return block;
}

/** Strip markdown inline markers for native text rendering. Link text
 *  is kept, URLs are dropped (the full article in the browser keeps
 *  them). No content is added or reworded. */
export function stripMarkdownInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[^A-Za-z0-9])_([^_]+)_/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1');
}

/** Split CMS markdown into native sections: h2/h3 headings, grouped
 *  bullet lists, and paragraphs. Verbatim text, only markers removed. */
export function markdownToSections(md: string): ArticleBlock[] {
  const sections: ArticleBlock[] = [];
  let pendingList: string[] = [];
  const flushList = () => {
    if (pendingList.length > 0) {
      sections.push({ type: 'ul', items: pendingList });
      pendingList = [];
    }
  };
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      sections.push({ type: 'h3', text: stripMarkdownInline(line.slice(4)) });
    } else if (line.startsWith('## ')) {
      flushList();
      sections.push({ type: 'h2', text: stripMarkdownInline(line.slice(3)) });
    } else if (line.startsWith('# ')) {
      flushList();
      sections.push({ type: 'h2', text: stripMarkdownInline(line.slice(2)) });
    } else if (/^[-*]\s+/.test(line)) {
      pendingList.push(stripMarkdownInline(line.replace(/^[-*]\s+/, '')));
    } else if (/^\d+\.\s+/.test(line)) {
      pendingList.push(stripMarkdownInline(line.replace(/^\d+\.\s+/, '')));
    } else {
      flushList();
      sections.push({ type: 'p', text: stripMarkdownInline(line) });
    }
  }
  flushList();
  return sections;
}

/** Absolute cover URL: the feed may return a site-relative path. */
export function absoluteCoverUrl(coverImage: string): string {
  if (coverImage === '') return '';
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  return `${SITE_BASE}${coverImage.startsWith('/') ? '' : '/'}${coverImage}`;
}

/**
 * Fetch one article body. Returns null on any failure (network, 404,
 * malformed body) so the screen can fall back to WebView/browser —
 * a missing body is never rendered as invented text.
 */
export async function fetchArticleBody(slug: string): Promise<ArticleBody | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BLOG_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(
        `${SITE_BASE}/api/blog/posts/${encodeURIComponent(slug)}`,
        { headers: { Accept: 'application/json' }, signal: controller.signal },
      );
    } catch {
      return null;
    }
    if (!res.ok) return null;
    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      return null;
    }
    if (!isRecord(data)) return null;
    const title = asString(data.title).trim();
    if (asString(data.slug).trim() === '' || title === '') return null;
    const bodyKind = asString(data.bodyKind);
    const blocks = Array.isArray(data.blocks)
      ? data.blocks
          .map(mapArticleBlock)
          .filter((b): b is ArticleBlock => b !== null)
      : [];
    return {
      slug: asString(data.slug),
      title,
      excerpt: asString(data.excerpt),
      coverImage: asString(data.coverImage),
      category: asString(data.category),
      publishedAt: asString(data.publishedAt),
      bodyKind:
        bodyKind === 'blocks' || bodyKind === 'markdown' ? bodyKind : null,
      blocks,
      bodyMd: asString(data.bodyMd),
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------- offline reading (v2, item 93) ---------------------- */

/**
 * Saved articles: full bodies from fetchArticleBody(), stored
 * device-local so the reader works offline. The body is the site's own
 * content, stored verbatim — never rewritten, summarised or translated.
 * The reader falls back to the saved copy only when the live fetch
 * fails (see fetchArticleBodyWithOfflineFallback); a saved copy is
 * never presented as live content.
 */
export const SAVED_ARTICLES_KEY = '@mqt/blog-saved-articles';
const MAX_SAVED_ARTICLES = 100;

export interface SavedArticleBody extends ArticleBody {
  savedAt: string;
}

function validateSavedArticle(raw: unknown): SavedArticleBody | null {
  if (!isRecord(raw)) return null;
  const slug = asString(raw.slug).trim();
  const title = asString(raw.title).trim();
  if (slug === '' || title === '') return null;
  const bodyKind = asString(raw.bodyKind);
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks
        .map(mapArticleBlock)
        .filter((b): b is ArticleBlock => b !== null)
    : [];
  return {
    slug,
    title,
    excerpt: asString(raw.excerpt),
    coverImage: asString(raw.coverImage),
    category: asString(raw.category),
    publishedAt: asString(raw.publishedAt),
    bodyKind:
      bodyKind === 'blocks' || bodyKind === 'markdown' ? bodyKind : null,
    blocks,
    bodyMd: asString(raw.bodyMd),
    savedAt: asString(raw.savedAt),
  };
}

/** Save (or refresh) one article body for offline reading. */
export async function saveArticleBody(article: ArticleBody): Promise<void> {
  try {
    const existing = await listSavedArticleBodies();
    const rest = existing.filter((a) => a.slug !== article.slug);
    const next: SavedArticleBody[] = [
      { ...article, savedAt: new Date().toISOString() },
      ...rest,
    ].slice(0, MAX_SAVED_ARTICLES);
    await AsyncStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: a storage failure must never break the reader.
  }
}

/** Newest-saved first; [] when nothing is stored or unreadable. */
export async function listSavedArticleBodies(): Promise<SavedArticleBody[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ARTICLES_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(validateSavedArticle)
      .filter((a): a is SavedArticleBody => a !== null);
  } catch {
    return [];
  }
}

export async function readSavedArticleBody(
  slug: string,
): Promise<SavedArticleBody | null> {
  const saved = await listSavedArticleBodies();
  return saved.find((a) => a.slug === slug) ?? null;
}

export async function removeSavedArticleBody(slug: string): Promise<void> {
  try {
    const saved = await listSavedArticleBodies();
    await AsyncStorage.setItem(
      SAVED_ARTICLES_KEY,
      JSON.stringify(saved.filter((a) => a.slug !== slug)),
    );
  } catch {
    // Best-effort only.
  }
}

export type ArticleLoadSource = 'live' | 'saved' | 'none';

/**
 * Load one article, preferring live. When the live fetch returns null
 * (offline, 404, malformed body) the saved copy is returned with
 * source 'saved' so the reader can label it honestly as an offline
 * copy. Source 'none' means neither live nor saved is available — the
 * reader then shows its metadata/browser fallback, never invented text.
 */
export async function fetchArticleBodyWithOfflineFallback(
  slug: string,
): Promise<{ article: ArticleBody | null; source: ArticleLoadSource }> {
  const live = await fetchArticleBody(slug);
  if (live !== null) return { article: live, source: 'live' };
  const saved = await readSavedArticleBody(slug);
  if (saved !== null) return { article: saved, source: 'saved' };
  return { article: null, source: 'none' };
}

/** ISO timestamp of the last successful blog-feed cache write, or null
 *  when no feed cache exists. Used for the "last updated" stamp. */
export async function readBlogCacheStamp(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(BLOG_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const cachedAt = parsed.cachedAt;
    return typeof cachedAt === 'number'
      ? new Date(cachedAt).toISOString()
      : null;
  } catch {
    return null;
  }
}
