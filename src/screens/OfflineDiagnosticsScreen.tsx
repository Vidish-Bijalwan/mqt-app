/**
 * Offline & diagnostics (v2, items 151 / 152 / 155).
 *
 * Exposes, on one screen: the offline pack with its "last updated"
 * stamp + manual sync, the queued-enquiry list with manual retry, saved
 * trip kits, and the device-local error log (view + clear). Everything
 * here is local: the error log is never sent anywhere (no
 * crash-reporting backend; Sentry is blocked pending a DSN decision).
 * "Retry all" sends queued enquiries ONLY when the user taps it —
 * nothing here auto-submits on mount.
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
import { submitEnquiry } from '../lib/api';
import {
  formatPackStamp,
  listTripKits,
  readOfflinePack,
  syncOfflinePack,
} from '../lib/offline';
import type { OfflinePack, TripKit } from '../lib/offline';
import {
  flushEnquiryQueue,
  listQueuedEnquiries,
  removeQueuedEnquiry,
} from '../lib/drafts';
import type { QueuedEnquiry } from '../lib/drafts';
import { clearErrorLog, listErrorLog } from '../lib/errorlog';
import type { ErrorLogEntry } from '../lib/errorlog';

export function OfflineDiagnosticsScreen() {
  const navigation = useNavigation() as unknown as {
    navigate: (name: string, params?: Record<string, unknown>) => void;
  };
  const { colors, fs, settings } = useSettings();
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueuedEnquiry[]>([]);
  const [flushNote, setFlushNote] = useState<string | null>(null);
  const [kits, setKits] = useState<TripKit[]>([]);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);

  const reload = useCallback(() => {
    void (async () => {
      const [p, q, k, e] = await Promise.all([
        readOfflinePack(),
        listQueuedEnquiries(),
        listTripKits(),
        listErrorLog(),
      ]);
      setPack(p);
      setQueued(q);
      setKits(k);
      setErrors(e);
    })();
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Offline & diagnostics
        </Text>

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Offline package pack
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Last updated: {formatPackStamp(pack)}
          {pack !== null
            ? ` · ${pack.packages.length} packages (${pack.source === 'live' ? 'last synced live' : pack.source === 'cache' ? 'from saved cache' : 'bundled fallback'})`
            : ''}
        </Text>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => {
            void syncOfflinePack().then(({ online }) => {
              setSyncNote(
                online
                  ? 'Synced live just now.'
                  : 'Could not reach the server — using the saved/bundled pack.',
              );
              reload();
            });
          }}>
          <Text style={styles.buttonText}>Sync offline pack</Text>
        </Pressable>
        {syncNote !== null ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>{syncNote}</Text>
        ) : null}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Queued enquiries ({queued.length})
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Enquiries that could not be sent are kept here and retried
          when the app returns to the foreground, or when you tap retry.
        </Text>
        {queued.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No queued enquiries.
          </Text>
        ) : (
          queued.map((q) => (
            <View
              key={q.id}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {q.input.packageName ?? 'Enquiry'}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                {q.input.name} · attempts: {q.attempts}
                {q.lastError !== '' ? ` · ${q.lastError}` : ''}
              </Text>
              <Pressable
                style={[styles.smallButton, styles.outlineButton]}
                onPress={() => {
                  void removeQueuedEnquiry(q.id).then(reload);
                }}>
                <Text style={[styles.smallButtonText, { color: colors.primary }]}>
                  Discard
                </Text>
              </Pressable>
            </View>
          ))
        )}
        {queued.length > 0 ? (
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => {
              void flushEnquiryQueue((item) =>
                submitEnquiry(item.input, item.formRenderedAt),
              ).then((r) => {
                setFlushNote(
                  `${r.sent.length} sent, ${r.failed.length} still queued.`,
                );
                reload();
              });
            }}>
            <Text style={styles.buttonText}>Retry all queued</Text>
          </Pressable>
        ) : null}
        {flushNote !== null ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>{flushNote}</Text>
        ) : null}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Trip kits ({kits.length})
        </Text>
        {kits.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No trip kits saved yet. Kits are created from your My Trips
            entries and work offline.
          </Text>
        ) : (
          kits.map((k) => (
            <Pressable
              key={k.ref}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('TripKit', { ref: k.ref })}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {k.packageName}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                Ref: {k.ref}
              </Text>
            </Pressable>
          ))
        )}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Error log ({errors.length})
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Device-local only — never sent anywhere. No crash-reporting
          backend is connected (Sentry needs a DSN decision first).
        </Text>
        {errors.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No errors logged.
          </Text>
        ) : (
          errors.map((e) => (
            <View
              key={e.id}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
                {e.source}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                {e.message}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                {new Date(e.timestamp).toLocaleString()}
              </Text>
            </View>
          ))
        )}
        {errors.length > 0 ? (
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => {
              void clearErrorLog().then(reload);
            }}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              Clear error log
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.heading, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Low-data mode
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          {settings.dataSaver
            ? 'On: blog covers use smaller images and the reader can hide covers for text-only reading.'
            : 'Off: toggle it in Account → Settings to use smaller blog images.'}
          {' '}Package cards still use the standard image size until
          PackageImage wiring lands (coordinator note).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  heading: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  note: { marginTop: SPACING.sm, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.md, marginTop: SPACING.sm },
  cardTitle: { fontWeight: WEIGHT.bold },
  cardMeta: { marginTop: SPACING.xs, lineHeight: 18 },
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
  smallButton: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  smallButtonText: { fontSize: 14, fontWeight: WEIGHT.bold },
});
