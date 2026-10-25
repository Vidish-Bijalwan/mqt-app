/**
 * Account hub (v1.2 rewrite). Sections: Profile (local only, prefills
 * Enquiry), Settings (see honesty labels below), Travelers, Communication
 * preferences, Login, Data & privacy, plus the existing site links and
 * version display (APP_VERSION, never bumped here).
 *
 * HONESTY LABELS, DO NOT REMOVE:
 * - Notification toggles (v1.3) control LOCAL alerts on this device
 *   (tripUpdates → departure reminders, reminders → price-drop /
 *   booking reminders). `offers` still records intent only — no offer
 *   feed exists yet, so it gates nothing. Remote push from the team is
 *   not connected yet; never present these as remote-push switches.
 * - The biometric toggle gates this tab's content only when the device
 *   actually supports it; when unavailable it explains why and stays off.
 * - Login is guest-only until OTP is connected (see LoginScreen).
 */
import React, { useCallback, useState } from 'react';
import {
  Linking,
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
import { APP_VERSION, BRAND, CONTACT } from '../constants';
import { callAction, whatsappAction } from '../lib/contact';
import { useUpdateChecker } from '../lib/appUpdates';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import {
  loadProfile,
  saveProfile,
} from '../lib/settings';
import type { FontScale, Profile } from '../lib/settings';
import {
  authenticateBiometric,
  checkBiometricAvailability,
} from '../lib/biometric';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Account'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const SITE = 'https://www.myquicktrippers.com';

const SITE_LINKS = [
  { label: 'About us', url: `${SITE}/about-us` },
  { label: 'Contact us', url: `${SITE}/contact-us` },
  { label: 'Privacy policy', url: `${SITE}/privacy-policy` },
  { label: 'Terms and conditions', url: `${SITE}/terms-and-conditions` },
] as const;

const FONT_SCALES: { label: string; value: FontScale }[] = [
  { label: 'Small', value: 0.85 },
  { label: 'Normal', value: 1 },
  { label: 'Large', value: 1.15 },
  { label: 'Largest', value: 1.3 },
];

export function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, fs, settings, updateSettings, t } = useSettings();
  const [profile, setProfile] = useState<Profile>({
    name: '',
    phone: '',
    email: '',
    homeCity: '',
    travelPreferences: '',
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [biometricNote, setBiometricNote] = useState<string | null>(null);
  // v2.0.3: in-app OTA update check (expo-updates). Restart happens
  // only from the explicit "Restart now" tap below — never here, and
  // never automatically after a download.
  const update = useUpdateChecker();
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadProfile().then((p) => {
        if (alive) setProfile(p);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  async function handleSaveProfile() {
    await saveProfile(profile);
    setProfileSaved(true);
  }

  async function handleBiometricToggle(next: boolean) {
    setBiometricNote(null);
    if (!next) {
      updateSettings({ biometricEnabled: false });
      setUnlocked(false);
      return;
    }
    const availability = await checkBiometricAvailability();
    if (!availability.available) {
      setBiometricNote(
        availability.reason ??
          'Biometric unlock is not available on this device.',
      );
      updateSettings({ biometricEnabled: false });
      return;
    }
    updateSettings({ biometricEnabled: true });
    setUnlocked(false);
  }

  async function handleUnlock() {
    setUnlocking(true);
    const ok = await authenticateBiometric();
    setUnlocking(false);
    if (ok) setUnlocked(true);
    else setBiometricNote('Unlock was cancelled or failed. Try again.');
  }

  // Biometric gate: when enabled, content stays hidden until unlocked.
  // If the module/device cannot authenticate, the toggle above can never
  // turn on, so this gate cannot lock a user out of their own account tab.
  // The locked screen also offers a "Turn off biometric lock" escape:
  // device-local data is unencrypted, so this gate is casual privacy,
  // not encryption — and a device whose biometrics change after the
  // lock was enabled must always have a way back in.
  if (settings.biometricEnabled && !unlocked) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}>
        <View style={styles.lockedBody}>
          <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
            Account is locked
          </Text>
          <Text style={[styles.lockedText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Biometric unlock is on for this tab. Unlock to see your account.
          </Text>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={handleUnlock}
            disabled={unlocking}>
            <Text style={styles.buttonText}>
              {unlocking ? 'Waiting…' : 'Unlock with biometrics'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.outlineButton]}
            onPress={() => {
              updateSettings({ biometricEnabled: false });
              setUnlocked(false);
            }}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
              Turn off biometric lock
            </Text>
          </Pressable>
          {biometricNote !== null ? (
            <Text style={[styles.lockedText, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              {biometricNote}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const n = settings.notifications;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {t('tabAccount')}
        </Text>
        <View style={[styles.guestBox, { backgroundColor: colors.estimatedBg }]}>
          <Text style={[styles.guestTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
            You are browsing as a guest
          </Text>
          <Text style={[styles.guestText, { color: colors.text, fontSize: fs(FONT.body) }]}>
            There is no sign-in in this version yet — OTP login is not
            connected. Your enquiries still reach the team, and trips you
            enquire about are saved on this device under My Trips.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {t('profile')}
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Saved on this device only. Used to prefill enquiry forms.
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.label, styles.cardFirstLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Name</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={profile.name}
            onChangeText={(v) => setProfile({ ...profile, name: v })}
            placeholder="Your full name"
            placeholderTextColor={colors.placeholderText}
            autoCapitalize="words"
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Phone</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={profile.phone}
            onChangeText={(v) => setProfile({ ...profile, phone: v })}
            placeholder="Mobile number"
            placeholderTextColor={colors.placeholderText}
            keyboardType="phone-pad"
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Email</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={profile.email}
            onChangeText={(v) => setProfile({ ...profile, email: v })}
            placeholder="you@example.com"
            placeholderTextColor={colors.placeholderText}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Home city</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={profile.homeCity}
            onChangeText={(v) => setProfile({ ...profile, homeCity: v })}
            placeholder="e.g. Dehradun"
            placeholderTextColor={colors.placeholderText}
            autoCapitalize="words"
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Travel preferences</Text>
          <TextInput
            style={[styles.input, styles.messageInput, { borderColor: colors.border, color: colors.text }]}
            value={profile.travelPreferences}
            onChangeText={(v) => setProfile({ ...profile, travelPreferences: v })}
            placeholder="e.g. Mountains, family trips, budget stays"
            placeholderTextColor={colors.placeholderText}
            multiline
          />
          <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSaveProfile}>
            <Text style={styles.buttonText}>{t('save')} profile</Text>
          </Pressable>
          {profileSaved ? (
            <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              Profile saved on this device.
            </Text>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {t('settings')}
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          These toggles control local alerts on this device (trip
          reminders, price drops) and record your offer-alert preference
          — remote push from the team is not connected yet. See the
          notification centre for all alerts and quiet hours.
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            style={styles.cardRow}
            onPress={() => navigation.navigate('Notifications')}>
            <Text style={[styles.cardRowLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Open notification centre</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
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
              Offers (recorded — no offer feed yet)
            </Text>
            <Switch
              value={n.offers}
              onValueChange={(v) =>
                updateSettings({ notifications: { ...n, offers: v } })
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

          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Language</Text>
          <View style={styles.choiceRow}>
            {(['en', 'hi'] as const).map((lang) => (
              <Pressable
                key={lang}
                style={[
                  styles.choice,
                  {
                    borderColor: settings.language === lang ? colors.primary : colors.border,
                    backgroundColor: settings.language === lang ? colors.primary : colors.background,
                  },
                ]}
                onPress={() => updateSettings({ language: lang })}>
                <Text style={[styles.choiceText, { color: settings.language === lang ? '#FFFFFF' : colors.text }]}>
                  {lang === 'en' ? 'English' : 'हिन्दी'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
              Low-data mode (preference)
            </Text>
            <Switch
              value={settings.dataSaver}
              onValueChange={(v) => updateSettings({ dataSaver: v })}
            />
          </View>

          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Theme</Text>
          <View style={styles.choiceRow}>
            {(['light', 'dark'] as const).map((theme) => (
              <Pressable
                key={theme}
                style={[
                  styles.choice,
                  {
                    borderColor: settings.theme === theme ? colors.primary : colors.border,
                    backgroundColor: settings.theme === theme ? colors.primary : colors.background,
                  },
                ]}
                onPress={() => updateSettings({ theme })}>
                <Text style={[styles.choiceText, { color: settings.theme === theme ? '#FFFFFF' : colors.text }]}>
                  {theme === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Font size</Text>
          <View style={styles.choiceRow}>
            {FONT_SCALES.map((s) => (
              <Pressable
                key={s.label}
                style={[
                  styles.choice,
                  {
                    borderColor: settings.fontScale === s.value ? colors.primary : colors.border,
                    backgroundColor: settings.fontScale === s.value ? colors.primary : colors.background,
                  },
                ]}
                onPress={() => updateSettings({ fontScale: s.value })}>
                <Text style={[styles.choiceText, { color: settings.fontScale === s.value ? '#FFFFFF' : colors.text }]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
              Biometric unlock for this tab
            </Text>
            <Switch
              value={settings.biometricEnabled}
              onValueChange={handleBiometricToggle}
            />
          </View>
          {biometricNote !== null ? (
            <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              {biometricNote}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {t('travelers')}
        </Text>
        <View style={[styles.navCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('Travelers')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Manage travelers</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Communication preferences
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          How you prefer the team to reach you about enquiries.
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>WhatsApp</Text>
            <Switch
              value={settings.whatsappPreferred}
              onValueChange={(v) => {
                updateSettings({
                  whatsappPreferred: v,
                  commPref: v ? 'whatsapp' : settings.commPref,
                });
              }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>SMS</Text>
            <Switch
              value={settings.smsPreferred}
              onValueChange={(v) => {
                updateSettings({
                  smsPreferred: v,
                  commPref: v ? 'sms' : settings.commPref,
                });
              }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Call</Text>
            <Switch
              value={settings.callPreferred}
              onValueChange={(v) => {
                updateSettings({
                  callPreferred: v,
                  commPref: v ? 'call' : settings.commPref,
                });
              }}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {t('login')}
        </Text>
        <View style={[styles.navCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Sign in (OTP not connected yet)</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {t('dataPrivacy')}
        </Text>
        <View style={[styles.navCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('DataPrivacy')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Export or delete my local data</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Explore
        </Text>
        <View style={[styles.navCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            style={[styles.navRow, { borderBottomWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Trust', undefined)}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Trust & safety</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, { borderBottomWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Offers')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Offers & more</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, { borderBottomWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Invite')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Invite friends</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, { borderBottomWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('DestinationHubs')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Destination guides</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, { borderBottomWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('OfflineDiagnostics')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Offline & diagnostics</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('Diagnostics')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>Release health</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Get help
        </Text>
        <View style={[styles.navCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.pairRow}>
            <Pressable style={[styles.pairButton, styles.primaryButton]} onPress={callAction}>
              <Text style={styles.buttonText}>Call {CONTACT.phoneDisplay}</Text>
            </Pressable>
            <Pressable
              style={[styles.pairButton, styles.whatsappButton]}
              onPress={() =>
                whatsappAction('Hi My Quick Trippers! I need help with my trip.')
              }>
              <Text style={styles.buttonText}>WhatsApp the team</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.navRow, { borderTopWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Trips')}>
            <Text style={[styles.navLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>View my trips</Text>
            <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          About My Quick Trippers
        </Text>
        <View style={[styles.navCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {SITE_LINKS.map((link, i) => (
            <Pressable
              key={link.url}
              style={[
                styles.navRow,
                i < SITE_LINKS.length - 1
                  ? { borderBottomWidth: 1, borderColor: colors.border }
                  : null,
              ]}
              onPress={() => Linking.openURL(link.url)}>
              <Text style={[styles.navLabel, { color: colors.primary, fontSize: fs(FONT.body) }]}>{link.label}</Text>
              <Text style={[styles.navChevron, { color: colors.muted }]}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          App updates
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Fixes for this installed version arrive over the air — no store
          download needed. An update is only applied when you tap
          Restart now. In the web preview the check reports up to date;
          the real check runs on the installed app.
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {update.status === 'checking' ? (
            <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              Checking for updates…
            </Text>
          ) : update.status === 'downloading' ? (
            <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
              Downloading update…
            </Text>
          ) : update.status === 'ready' ? (
            <>
              <Text style={[styles.note, { color: colors.text, fontSize: fs(FONT.body) }]}>
                Update downloaded — restart to apply it.
              </Text>
              <Pressable style={[styles.button, styles.primaryButton]} onPress={() => void update.restartNow()}>
                <Text style={styles.buttonText}>Restart now</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.outlineButton]} onPress={update.dismissReady}>
                <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Later</Text>
              </Pressable>
            </>
          ) : update.status === 'up-to-date' ? (
            <>
              <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                You&apos;re up to date.
              </Text>
              <Pressable style={[styles.button, styles.outlineButton]} onPress={() => void update.checkForUpdates()}>
                <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Check again</Text>
              </Pressable>
            </>
          ) : update.status === 'error' ? (
            <>
              <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                {update.error ?? 'Could not check for updates.'}
              </Text>
              <Pressable style={[styles.button, styles.outlineButton]} onPress={() => void update.checkForUpdates()}>
                <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={[styles.button, styles.primaryButton]} onPress={() => void update.checkForUpdates()}>
              <Text style={styles.buttonText}>Check for updates</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.version, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          {BRAND.name} · App version {APP_VERSION}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  guestBox: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADII.card },
  guestTitle: { fontWeight: WEIGHT.bold },
  guestText: { marginTop: SPACING.sm, lineHeight: 22 },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  note: { marginTop: SPACING.sm, lineHeight: 20 },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.lg },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: SPACING.sm,
  },
  messageInput: { minHeight: 80, textAlignVertical: 'top' },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  primaryButton: { backgroundColor: '#127C82' },
  whatsappButton: { backgroundColor: '#25D366' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
  card: {
    borderWidth: 1,
    borderRadius: RADII.card,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  cardFirstLabel: { marginTop: 0 },
  navCard: {
    borderWidth: 1,
    borderRadius: RADII.card,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  navLabel: { flex: 1, fontWeight: WEIGHT.bold, paddingRight: SPACING.sm },
  navChevron: { fontSize: 20 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  cardRowLabel: { flex: 1, fontWeight: WEIGHT.bold, paddingRight: SPACING.sm },
  pairRow: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg },
  pairButton: {
    flex: 1,
    borderRadius: RADII.button,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: SPACING.sm,
  },
  toggleLabel: { flex: 1, flexShrink: 1, paddingRight: SPACING.md },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  choice: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
  },
  choiceText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  version: { marginTop: SPACING.xl, textAlign: 'center' },
  lockedBody: { flex: 1, justifyContent: 'center', padding: SPACING.xl },
  lockedText: { marginTop: SPACING.md, textAlign: 'center', lineHeight: 22 },
});
