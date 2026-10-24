/**
 * Release health (v2, item 209) — DEVICE-LOCAL diagnostics only.
 *
 * Shows: app version, startup time (once the coordinator wires
 * markAppReady() into launch; until then it honestly says "not
 * recorded yet"), this screen's own render time, API error counts
 * recorded by diagnostics.ts, the on-device error log, and last sync
 * stamps from the existing catalogue/config caches.
 *
 * HONEST LIMIT, stated on screen: remote crash reporting is NOT
 * connected — no Sentry DSN exists, so no crash data leaves this
 * device and no crash-free rate is shown. Nothing here is estimated
 * or sampled: empty counts mean "nothing recorded", not "zero crashes".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearApiErrorCounts,
  clearErrorLog,
  getErrorLog,
  getReleaseHealth,
  useScreenRenderTime,
} from '../lib/diagnostics';
import type { DiagnosticErrorEntry, ReleaseHealth } from '../lib/diagnostics';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

function formatStamp(value: number | null): string {
  if (value === null) return 'Not recorded yet';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DiagnosticsScreen() {
  const { colors, fs } = useSettings();
  const renderMs = useScreenRenderTime();
  const [health, setHealth] = useState<ReleaseHealth | null>(null);
  const [errors, setErrors] = useState<DiagnosticErrorEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(() => {
    void getReleaseHealth().then(setHealth);
    void getErrorLog().then(setErrors);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClear() {
    await clearErrorLog();
    await clearApiErrorCounts();
    setStatus('On-device diagnostics cleared.');
    load();
  }

  const apiEntries =
    health === null ? [] : Object.entries(health.apiErrorCounts);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Release health
        </Text>
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Diagnostics stored only on this device. Nothing here is sent
          anywhere.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          App version
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          {health === null ? 'Loading…' : `v${health.appVersion}`}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Startup time
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          {health === null
            ? 'Loading…'
            : health.startupMs === null
              ? 'Not recorded yet — startup marking is wired at launch (see release notes for coordinators).'
              : `${health.startupMs} ms from app load to first screen`}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          This screen&apos;s render time
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          {renderMs === null ? 'Measuring…' : `${renderMs} ms`}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          API errors recorded
        </Text>
        {health === null ? (
          <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>Loading…</Text>
        ) : apiEntries.length === 0 ? (
          <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
            No API errors recorded on this device yet.
          </Text>
        ) : (
          apiEntries.map(([endpoint, count]) => (
            <Text
              key={endpoint}
              style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
              {endpoint}: {count}
            </Text>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Last sync
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Catalogue:{' '}
          {health === null
            ? 'Loading…'
            : (health.lastSync.catalogUpdatedAt ?? 'Never synced')}
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Remote config cached:{' '}
          {health === null
            ? 'Loading…'
            : formatStamp(health.lastSync.configCachedAt)}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          On-device error log ({errors.length})
        </Text>
        {errors.length === 0 ? (
          <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
            No errors logged on this device yet.
          </Text>
        ) : (
          errors.slice(0, 10).map((entry) => (
            <Text
              key={`${entry.timestamp}-${entry.source}`}
              style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
              {formatStamp(entry.timestamp)} · {entry.source}: {entry.message}
            </Text>
          ))
        )}

        <View style={[styles.notice, { backgroundColor: colors.estimatedBg }]}>
          <Text style={[styles.noticeText, { color: colors.text, fontSize: fs(FONT.body) }]}>
            Remote crash reporting is not connected — no crash-reporting
            service is configured, so no crash-free rate is shown here.
            This screen only reports what this device recorded itself.
          </Text>
        </View>

        <Pressable style={[styles.button, styles.primaryButton]} onPress={load}>
          <Text style={styles.buttonText}>Refresh</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.outlineButton]} onPress={() => void handleClear()}>
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
            Clear on-device diagnostics
          </Text>
        </Pressable>
        {status !== null ? (
          <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>{status}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  text: { marginTop: SPACING.sm, lineHeight: 22 },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  notice: { marginTop: SPACING.xl, padding: SPACING.lg, borderRadius: RADII.card },
  noticeText: { lineHeight: 22 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  primaryButton: { backgroundColor: '#127C82' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
});
