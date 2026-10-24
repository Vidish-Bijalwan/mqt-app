import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BRAND } from '../constants';
import { SITE_BASE } from '../lib/api';

const BLOG_URL = `${SITE_BASE}/blog`;

/**
 * v1 blog approach: the site's own blog page in a WebView. The website's
 * CMS blog table is empty (GET /api/blog/posts returns {"posts":[]}),
 * so there is no posts API to build a native list from — and no fake
 * post content is bundled. v2 can add a native list once the site
 * exposes real posts.
 */
export function BlogScreen() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (Platform.OS === 'web') {
    // Web preview: keep the blog on the website rather than nesting a
    // WebView inside the web build.
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Blog</Text>
        <Text style={styles.text}>
          Read travel guides and stories on the My Quick Trippers blog.
        </Text>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => Linking.openURL(BLOG_URL)}>
          <Text style={styles.buttonText}>Open blog in browser</Text>
        </Pressable>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Could not load the blog</Text>
        <Text style={styles.text}>
          Please check your connection and try again, or read it in your
          browser.
        </Text>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => {
            setFailed(false);
            setLoading(true);
          }}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => Linking.openURL(BLOG_URL)}>
          <Text style={styles.secondaryButtonText}>Open in browser</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.loadingText}>Loading blog…</Text>
        </View>
      ) : null}
      <WebView
        source={{ uri: BLOG_URL }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onHttpError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: BRAND.background,
  },
  loading: {
    alignItems: 'center',
    paddingTop: 40,
    backgroundColor: BRAND.background,
  },
  loadingText: { fontSize: 15, color: BRAND.muted, marginTop: 10 },
  title: { fontSize: 20, fontWeight: '700', color: BRAND.text, textAlign: 'center' },
  text: {
    fontSize: 15,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButton: { backgroundColor: BRAND.primary },
  secondaryButton: { borderWidth: 1, borderColor: BRAND.primary },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: BRAND.primary, fontSize: 16, fontWeight: '700' },
});
