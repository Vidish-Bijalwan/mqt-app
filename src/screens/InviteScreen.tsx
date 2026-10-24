/**
 * App invite via link + Share sheet + real QR code (v2 item 194).
 * The QR value is exactly the same link string shown on screen
 * (referral link when a record exists, else the site home URL).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import {
  APP_INVITE_URL,
  getOrCreateReferral,
  referralLink,
  shareAppInvite,
} from '../lib/share';
import type { ReferralRecord } from '../lib/share';

export function InviteScreen() {
  const { colors, fs } = useSettings();
  const [record, setRecord] = useState<ReferralRecord | null>(null);

  useEffect(() => {
    let alive = true;
    void getOrCreateReferral().then((r) => {
      if (alive) setRecord(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const link = record !== null ? referralLink(record.code) : APP_INVITE_URL;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.body}>
      <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
        Invite friends to the app
      </Text>
      <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
        Share this link — friends can open it to reach My Quick Trippers
        and plan their trip with the team.
      </Text>
      <View style={[styles.qrBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <QRCode value={link} size={220} backgroundColor="#FFFFFF" color="#1A1A1A" />
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          Scan this code to open the invite link above.
        </Text>
      </View>
      <Text style={[styles.link, { color: colors.primary, fontSize: fs(FONT.body) }]} selectable>
        {link}
      </Text>
      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={() => void shareAppInvite(record !== null ? record.code : '')}
        accessibilityLabel="Share invite link">
        <Text style={[styles.buttonText, { fontSize: fs(FONT.body) }]}>Share invite link</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  title: { fontWeight: WEIGHT.bold },
  text: { lineHeight: 22, textAlign: 'center' },
  qrBox: {
    borderWidth: 1,
    borderRadius: RADII.card,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  note: { lineHeight: 19, textAlign: 'center' },
  link: { lineHeight: 22, textAlign: 'center' },
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: RADII.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold },
});
