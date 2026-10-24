/**
 * Low-data mode (v2, item 160).
 *
 * The setting itself already exists (settings.dataSaver, toggled on
 * the Account screen) — this module gives it behaviour in the blog
 * surfaces owned by this batch, without touching PackageImage.tsx
 * (owned by another builder; its wiring is a coordinator note below).
 *
 * Image rule mirrors the site's verified optimizer behaviour (see
 * PackageImage.tsx): site-hosted paths go through /_next/image at an
 * allowed width. Low-data uses the smallest allowed width, w=640
 * (verified smaller than w=750); widths outside the allowed list
 * return 400, so no other width is used. External URLs are never sent
 * to the optimizer — the original URL is returned unchanged.
 * Text-only blog = the reader/list hides cover images entirely when
 * dataSaver is on; article text itself is unchanged.
 *
 * COORDINATOR NOTE: PackageImage.tsx still always uses w=750. To
 * apply low-data mode to package cards, that component must read
 * settings.dataSaver and switch its optimizer width to w=640 (this
 * helper's lowDataOptimizedUrl can be reused once imported there).
 */
import { loadSettings } from './settings';
import { absoluteCoverUrl } from './blog';
import { SITE_BASE } from './api';

export const LOW_DATA_IMAGE_WIDTH = 640;
export const STANDARD_IMAGE_WIDTH = 750;

/** True when the user has low-data mode on (settings.dataSaver). */
export async function isLowDataEnabled(): Promise<boolean> {
  try {
    const settings = await loadSettings();
    return settings.dataSaver === true;
  } catch {
    return false;
  }
}

/**
 * Low-data optimizer URL for a site-hosted image, or null when the
 * URL is not site-hosted (caller falls back to the original URL).
 * Accepts site-absolute or site-relative URLs.
 */
export function lowDataOptimizedUrl(uri: string): string | null {
  let path: string | null = null;
  if (uri.startsWith(SITE_BASE)) {
    path = uri.slice(SITE_BASE.length);
  } else if (uri.startsWith('/')) {
    path = uri;
  }
  if (path === null || path === '') return null;
  return (
    `${SITE_BASE}/_next/image?url=${encodeURIComponent(path)}` +
    `&w=${LOW_DATA_IMAGE_WIDTH}&q=60`
  );
}

/**
 * Cover URL for a blog article under low-data mode: the w=640
 * optimizer URL when the cover is site-hosted, otherwise the plain
 * absolute cover URL. When lowData is false, the plain URL is used.
 */
export function blogCoverUrl(coverImage: string, lowData: boolean): string {
  const absolute = absoluteCoverUrl(coverImage);
  if (!lowData || absolute === '') return absolute;
  return lowDataOptimizedUrl(absolute) ?? absolute;
}
