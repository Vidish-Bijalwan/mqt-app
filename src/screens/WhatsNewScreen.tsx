/**
 * What's new (v2, item 206). Renders the REAL changelog from
 * src/lib/changelog.ts, newest first. When `sinceVersion` is given,
 * only entries newer than it are shown (the post-update view the
 * coordinator navigates to after the whatsNew version-stamp check);
 * without it, the full changelog shows. No entry is ever invented
 * here — add releases only in changelog.ts, with real shipped work.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHANGELOG } from '../lib/changelog';
import { compareVersions } from '../lib/appConfig';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

export function WhatsNewScreen({
  sinceVersion,
  onDone,
}: {
  sinceVersion?: string;
  onDone?: () => void;
}) {
  const { colors, fs } = useSettings();
  const entries =
    sinceVersion === undefined || sinceVersion === ''
      ? CHANGELOG
      : CHANGELOG.filter(
          (entry) => compareVersions(entry.version, sinceVersion) > 0,
        );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          What&apos;s new
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Real changes in each release — no filler, no promised features.
        </Text>
        {entries.length === 0 ? (
          <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
            You&apos;re up to date — nothing new since your last version.
          </Text>
        ) : (
          entries.map((entry) => (
            <View key={entry.version} style={styles.entry}>
              <Text style={[styles.version, { color: colors.primary, fontSize: fs(FONT.heading) }]}>
                {entry.title} · v{entry.version}
              </Text>
              {entry.items.map((item) => (
                <Text
                  key={item}
                  style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
                  • {item}
                </Text>
              ))}
            </View>
          ))
        )}
        {onDone !== undefined ? (
          <Pressable style={[styles.button, styles.primaryButton]} onPress={onDone}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  subtitle: { marginTop: SPACING.sm, lineHeight: 22 },
  entry: { marginTop: SPACING.xl },
  version: { fontWeight: WEIGHT.bold },
  text: { marginTop: SPACING.sm, lineHeight: 22 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  primaryButton: { backgroundColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
});
