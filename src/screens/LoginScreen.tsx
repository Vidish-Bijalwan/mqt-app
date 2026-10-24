/**
 * Login (v1.2). HONEST PLACEHOLDER — item 71 stays BLOCKED.
 * OTP login is NOT connected: no SMS provider has been chosen and no
 * OTP backend exists, so the 'Send OTP' button is DISABLED and no OTP
 * flow is faked. lib/auth.ts mirrors this: every function returns
 * 'not configured' and never reports success. Browsing stays in guest
 * mode; enquiries and trips still work without an account.
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuthStatus } from '../lib/auth';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

export function LoginScreen() {
  const { colors, fs, t } = useSettings();
  const [phone, setPhone] = useState('');
  const [checked, setChecked] = useState(false);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {t('login')}
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          You are browsing as a guest. Sign-in will let you sync trips and
          details across devices once it is connected.
        </Text>
        <View style={[styles.notice, { backgroundColor: colors.estimatedBg }]}>
          <Text style={[styles.noticeText, { color: colors.text, fontSize: fs(FONT.body) }]}>
            OTP login is not connected yet — no SMS provider has been
            chosen, so no code can be sent right now. Please use the app
            as a guest; your enquiries still reach the team.
          </Text>
        </View>
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Phone number</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          placeholderTextColor={colors.placeholderText}
          keyboardType="phone-pad"
        />
        <Pressable
          style={[styles.button, styles.disabledButton]}
          disabled
          onPress={() => {
            // Disabled by design: OTP login is not configured (see
            // lib/auth.ts). This handler must never run while disabled.
            void getAuthStatus().then((s) => {
              if (s.configured) setChecked(true);
            });
          }}>
          <Text style={styles.buttonText}>Send OTP (not available yet)</Text>
        </Pressable>
        {checked ? (
          <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            Auth is still not configured.
          </Text>
        ) : null}
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          No code will be sent and no account is created from this screen.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  text: { marginTop: SPACING.md, lineHeight: 22 },
  notice: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADII.card },
  noticeText: { lineHeight: 22 },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.lg },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: SPACING.sm,
  },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  disabledButton: { backgroundColor: '#888888', opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  note: { marginTop: SPACING.md, lineHeight: 20 },
});
