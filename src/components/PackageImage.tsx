import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { DURATIONS } from '../theme/tokens';
import type { Palette } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { lowDataOptimizedUrl } from '../lib/lowdata';
import { SITE_BASE_URL } from '../data/packages';

interface Props {
  uri: string | null;
  /** Height of the image area. Width is always full container width. */
  height: number;
}

/**
 * Server-side resized image URL for a site-hosted photo.
 *
 * Verified live 2026-10-24: the site's Next.js optimizer returns a smaller
 * JPEG for site-relative paths at the widths Next.js allows (640/750/828):
 * /images/packages/hi-kaziranga-tour-package.webp is 415,798 bytes as a
 * direct WebP but 58,460 bytes as a w=640 JPEG (78,845 at w=750).
 * Widths outside the site's allowed list (e.g. w=800) return
 * 400 INVALID_IMAGE_OPTIMIZE_REQUEST, so this uses w=750 only.
 * External (non-site) URLs are never sent to the optimizer.
 */
export function optimizedImageUrl(uri: string): string | null {
  let path: string | null = null;
  if (uri.startsWith(SITE_BASE_URL)) {
    path = uri.slice(SITE_BASE_URL.length);
  } else if (uri.startsWith('/')) {
    path = uri;
  }
  if (!path) return null;
  return (
    `${SITE_BASE_URL}/_next/image?url=${encodeURIComponent(path)}` +
    `&w=750&q=75`
  );
}

/**
 * Real package photo from myquicktrippers.com, or an honest grey
 * placeholder when the image is missing or fails to load.
 * NEVER a fake photo or an AI image presented as a real photo.
 *
 * Pipeline: expo-image with memory-disk caching and a 150ms transition.
 * The resized optimizer URL is tried first; on error it falls back to the
 * original URL, and only if that also fails does the placeholder show.
 */
export function PackageImage({ uri, height }: Props) {
  // v2 item 160: low-data mode uses the smaller verified optimizer
  // width (w=640) for site photos; external URLs never go through the
  // optimizer (lowDataOptimizedUrl returns null for them, and we fall
  // back to the standard w=750 URL).
  const { colors, settings } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Hooks must stay above the early return below: this tracks whether
  // the current uri's photo has loaded (see the skeleton comment at
  // the render site). Keyed by uri, so a new photo resets it.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const photoLoaded = loadedUri === uri;
  const optimized = useMemo(
    () =>
      uri
        ? (settings.dataSaver
            ? lowDataOptimizedUrl(uri)
            : null) ?? optimizedImageUrl(uri)
        : null,
    [uri, settings.dataSaver],
  );
  // Failure tracking, keyed by uri so a new uri resets the pipeline
  // without an effect: 'optimized' -> 'original' -> 'failed'.
  const [errored, setErrored] = useState<{
    uri: string;
    stage: 'optimized' | 'original';
  } | null>(null);
  const stage: 'optimized' | 'original' | 'failed' =
    errored !== null && errored.uri === uri
      ? errored.stage === 'optimized'
        ? 'original'
        : 'failed'
      : optimized
        ? 'optimized'
        : 'original';

  if (!uri || stage === 'failed') {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>Photo unavailable</Text>
      </View>
    );
  }

  const sourceUri = stage === 'optimized' && optimized ? optimized : uri;
  // v2.0.2 finger-fast detail: the detail screen already renders its
  // title/price/actions instantly (v2.0.1 param passthrough); the
  // skeleton below is what the photo area shows while the photo itself
  // loads. It is NOT a fake photo: it disappears the moment the real
  // photo loads (onLoad).

  return (
    <View style={[styles.container, { height }]}>
      {!photoLoaded ? (
        <View style={styles.skeleton}>
          <Text style={styles.skeletonText}>Loading photo…</Text>
        </View>
      ) : null}
      <Image
        source={{ uri: sourceUri }}
        style={styles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={DURATIONS.fast}
        onLoad={() => setLoadedUri(uri)}
        onError={() => {
          if (stage === 'optimized' || stage === 'original') {
            setErrored({ uri, stage });
          }
        }}
      />
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: c.placeholderBg,
  },
  skeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonText: {
    color: c.placeholderText,
    fontSize: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    backgroundColor: c.placeholderBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: c.placeholderText,
    fontSize: 14,
  },
  });
}
