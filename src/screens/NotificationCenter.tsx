/**
 * Notification centre (v1.3, item 167).
 *
 * One list for every real alert: delivered notifications, scheduled
 * upcoming reminders, and price-drop entries — each tracing to a real
 * scheduled/delivered event or a real catalogue comparison (see
 * lib/notifications.ts). Mark-all-read, per-item dismiss, and deep
 * links only where real (package detail for price drops, My Trips for
 * reminders/bookings). Nothing here is invented: when there are no
 * alerts, the empty state says so plainly.
 *
 * Also hosts the notification settings (item 166): per-type toggles
 * (real gates for local notifications) and quiet-hours controls, which
 * genuinely shift scheduled delivery (see applyQuietHours). Offer
 * alerts are labelled honestly — no offer feed exists yet, so the
 * toggle records intent and schedules nothing.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { whatsappAction } from '../lib/contact';
import { normalizeQuietHours } from '../lib/settings';
import type { QuietHours } from '../lib/settings';
import {
  DEFERRED_NOTIFICATION_FEATURES,
  checkAbandonedDraft,
  consumePendingLink,
  dismissEntry,
  getPermissionStatus,
  listCenterEntries,
  markAllRead,
  requestNotificationPermission,
  rescheduleTripReminders,
} from '../lib/notifications';
import type {
  NotificationDeepLink,
  NotificationEntry,
  PermissionStatus,
} from '../lib/notifications';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Account'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function kindLabel(kind: NotificationEntry['kind']): string {
  switch (kind) {
    case 'price-drop':
      return 'Price drop';
    case 'reminder':
      return 'Reminder';
    case 'booking':
      return 'Booking update';
    case 'received':
      return 'Received';
    case 'scheduled':
      return 'Scheduled';
    case 'abandoned':
      return 'Reminder';
    default:
      return 'Notification';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationCenter() {
  const navigation = useNavigation<Nav>();
  const { colors, fs, settings, updateSettings } = useSettings();
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<PermissionStatus>('undetermined');
  const [enabling, setEnabling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [quietStart, setQuietStart] = useState(settings.quietHours.start);
  const [quietEnd, setQuietEnd] = useState(settings.quietHours.end);
  const [quietNote, setQuietNote] = useState<string | null>(null);

  const followLink = useCallback(
    (link: NotificationDeepLink) => {
      if (link.screen === 'PackageDetail' && link.slug) {
        navigation.navigate('PackageDetail', { slug: link.slug });
      } else if (link.screen === 'Trips') {
        navigation.navigate('Tabs', { screen: 'Trips' });
      }
      // 'Notifications' links land here already — no navigation needed.
    },
    [navigation],
  );

  const reload = useCallback(async () => {
    const [list, status] = await Promise.all([
      listCenterEntries(),
      getPermissionStatus(),
    ]);
    setEntries(list);
    setPermission(status);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void reload();
      // A notification tap that arrived before navigation was ready.
      void consumePendingLink().then((link) => {
        if (alive && link !== null) followLink(link);
      });
      return () => {
        alive = false;
      };
    }, [reload, followLink]),
  );

  async function handleEnable() {
    setEnabling(true);
    const status = await requestNotificationPermission();
    setPermission(status);
    setEnabling(false);
  }

  async function handleDismiss(id: string) {
    await dismissEntry(id);
    await reload();
  }

  async function handleMarkAllRead() {
    await markAllRead();
    await reload();
  }

  async function handleRefreshReminders() {
    setRefreshing(true);
    setRefreshNote(null);
    try {
      const created = await rescheduleTripReminders();
      const draftResult = await checkAbandonedDraft();
      await reload();
      setRefreshNote(
        `Reminders refreshed: ${created.length} upcoming reminder(s) scheduled.` +
          (draftResult === 'reminded'
            ? ' One abandoned-enquiry reminder sent.'
            : ''),
      );
    } catch {
      setRefreshNote('Could not refresh reminders. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }

  function handleSaveQuietHours() {
    const next: QuietHours = normalizeQuietHours({
      enabled: settings.quietHours.enabled,
      start: quietStart.trim(),
      end: quietEnd.trim(),
    });
    // normalizeQuietHours silently falls back to defaults on bad input;
    // surface that instead of pretending the typed value was saved.
    if (
      next.start !== quietStart.trim() ||
      next.end !== quietEnd.trim()
    ) {
      setQuietNote('Use HH:MM 24-hour times (e.g. 22:00). Nothing was changed.');
      return;
    }
    updateSettings({ quietHours: next });
    setQuietNote(
      next.enabled
        ? `Quiet hours saved: ${next.start}–${next.end}. Scheduled notifications in that window move past ${next.end}.`
        : 'Quiet hours saved (off).',
    );
  }

  const n = settings.notifications;
  const unread = entries.filter((e) => !e.read).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Notifications
        </Text>

        {Platform.OS === 'web' ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            This web preview shows the notification centre only — real
            notification delivery works on your phone in the app.
          </Text>
        ) : permission !== 'granted' ? (
          <View style={[styles.banner, { backgroundColor: colors.estimatedBg }]}>
            <Text style={[styles.bannerText, { color: colors.text, fontSize: fs(FONT.body) }]}>
              {permission === 'denied'
                ? 'Notifications are off for this app. Turn them on in your device settings to receive trip reminders and price drops.'
                : 'Turn on notifications to receive trip reminders and price-drop alerts on this device.'}
            </Text>
            {permission !== 'denied' ? (
              <Pressable
                style={[styles.button, styles.primaryButton]}
                onPress={handleEnable}
                disabled={enabling}>
                <Text style={styles.buttonText}>
                  {enabling ? 'Waiting…' : 'Enable notifications'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Notifications are on for this device. Remote push from the
            team is not connected yet — these are local alerts scheduled
            on your phone.
          </Text>
        )}

        <View style={styles.rowBetween}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
            All alerts{unread > 0 ? ` (${unread} unread)` : ''}
          </Text>
          {entries.length > 0 ? (
            <Pressable onPress={handleMarkAllRead}>
              <Text style={[styles.linkText, { color: colors.primary, fontSize: fs(FONT.body) }]}>
                Mark all read
              </Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : entries.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              No notifications yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              Trip reminders, price drops and booking updates will appear
              here. Reminders are scheduled from your saved trips that
              have a travel date.
            </Text>
            <Pressable
              style={[styles.button, styles.outlineButton]}
              onPress={handleRefreshReminders}
              disabled={refreshing}>
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
                {refreshing ? 'Refreshing…' : 'Refresh reminders'}
              </Text>
            </Pressable>
          </View>
        ) : (
          entries.map((entry) => (
            <View
              key={entry.id}
              style={[
                styles.card,
                {
                  borderColor: colors.border,
                  backgroundColor: entry.read ? colors.card : colors.estimatedBg,
                },
              ]}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardKind, { color: colors.primary, fontSize: fs(FONT.meta) }]}>
                  {kindLabel(entry.kind).toUpperCase()}
                  {entry.scheduledFor
                    ? ` · ${formatDateTime(entry.scheduledFor)}`
                    : ` · ${formatDate(entry.createdAt)}`}
                </Text>
                <Pressable
                  onPress={() => void handleDismiss(entry.id)}
                  hitSlop={8}>
                  <Text style={[styles.dismiss, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                    Dismiss
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                {entry.title}
              </Text>
              <Text style={[styles.cardBody, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                {entry.body}
              </Text>
              <View style={styles.cardActions}>
                {entry.deepLink ? (
                  <Pressable
                    style={[styles.smallButton, styles.outlineSmall]}
                    onPress={() => followLink(entry.deepLink as NotificationDeepLink)}>
                    <Text style={[styles.smallButtonText, { color: colors.primary }]}>
                      {entry.deepLink.screen === 'PackageDetail'
                        ? 'View package'
                        : entry.deepLink.screen === 'Trips'
                          ? 'View my trips'
                          : 'Open notifications'}
                    </Text>
                  </Pressable>
                ) : null}
                {entry.whatsappMessage ? (
                  <Pressable
                    style={[styles.smallButton, styles.whatsappSmall]}
                    onPress={() => void whatsappAction(entry.whatsappMessage as string)}>
                    <Text style={styles.smallButtonTextWhite}>WhatsApp the team</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
        {refreshNote !== null ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            {refreshNote}
          </Text>
        ) : null}
        {entries.length > 0 ? (
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={handleRefreshReminders}
            disabled={refreshing}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              {refreshing ? 'Refreshing…' : 'Refresh reminders'}
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Notification settings
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          These switches control local alerts on this device. Trip
          updates control departure reminders; reminders control
          price-drop and booking reminders. Offer alerts are recorded
          here but schedule nothing until the team publishes an offer
          feed.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
            Trip updates (departure reminders)
          </Text>
          <Switch
            value={n.tripUpdates}
            onValueChange={(v) =>
              updateSettings({ notifications: { ...n, tripUpdates: v } })
            }
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
            Reminders (price drops, bookings)
          </Text>
          <Switch
            value={n.reminders}
            onValueChange={(v) =>
              updateSettings({ notifications: { ...n, reminders: v } })
            }
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
            Offers (recorded — no offer feed yet)
          </Text>
          <Switch
            value={n.offers}
            onValueChange={(v) =>
              updateSettings({ notifications: { ...n, offers: v } })
            }
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Quiet hours
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Scheduled notifications that would arrive during quiet hours
          are moved to just after the window ends.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
            Quiet hours
          </Text>
          <Switch
            value={settings.quietHours.enabled}
            onValueChange={(v) =>
              updateSettings({
                quietHours: { ...settings.quietHours, enabled: v },
              })
            }
          />
        </View>
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Start (HH:MM)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={quietStart}
          onChangeText={setQuietStart}
          placeholder="22:00"
          placeholderTextColor={colors.placeholderText}
        />
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>End (HH:MM)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={quietEnd}
          onChangeText={setQuietEnd}
          placeholder="07:00"
          placeholderTextColor={colors.placeholderText}
        />
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={handleSaveQuietHours}>
          <Text style={styles.buttonText}>Save quiet hours</Text>
        </Pressable>
        {quietNote !== null ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            {quietNote}
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Not available yet
        </Text>
        {DEFERRED_NOTIFICATION_FEATURES.map((f) => (
          <View key={f.id} style={styles.deferredRow}>
            <Text style={[styles.deferredTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>
              {f.label}
            </Text>
            <Text style={[styles.deferredReason, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              {f.reason}
            </Text>
          </View>
        ))}
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Critical booking updates still reach you: booking entries here
          include a WhatsApp action to the team — no new SMS system was
          added.
        </Text>
        <Pressable
          onPress={() => void Linking.openURL('https://www.myquicktrippers.com')}>
          <Text style={[styles.linkText, { color: colors.primary, fontSize: fs(FONT.body) }]}>
            Visit myquicktrippers.com
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
  note: { marginTop: SPACING.sm, lineHeight: 20 },
  banner: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADII.card },
  bannerText: { lineHeight: 22 },
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
  },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  linkText: { fontWeight: WEIGHT.bold },
  loader: { marginTop: SPACING.xl },
  emptyBox: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADII.card,
  },
  emptyTitle: { fontWeight: WEIGHT.bold },
  emptyText: { marginTop: SPACING.sm, lineHeight: 22 },
  card: {
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADII.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardKind: { fontWeight: WEIGHT.bold, flex: 1, flexShrink: 1 },
  dismiss: { marginLeft: SPACING.md },
  cardTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.sm },
  cardBody: { marginTop: SPACING.sm, lineHeight: 22 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  smallButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
  },
  outlineSmall: { borderWidth: 1, borderColor: '#127C82' },
  whatsappSmall: { backgroundColor: '#25D366' },
  smallButtonText: { fontSize: 14, fontWeight: WEIGHT.bold },
  smallButtonTextWhite: { color: '#FFFFFF', fontSize: 14, fontWeight: WEIGHT.bold },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH_MIN,
    paddingVertical: SPACING.sm,
  },
  toggleLabel: { flex: 1, flexShrink: 1, paddingRight: SPACING.md },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.lg },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: SPACING.sm,
  },
  deferredRow: { marginTop: SPACING.md },
  deferredTitle: { fontWeight: WEIGHT.bold },
  deferredReason: { marginTop: 2, lineHeight: 20 },
});
