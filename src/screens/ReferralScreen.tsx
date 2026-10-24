/**
 * Referral program, mechanism only (v2 item 191).
 *
 * The benefit is OFF/empty: the business has not defined any referral
 * benefit, so no value, percentage, or coupon is shown or promised
 * anywhere on this screen. What exists is a shareable referral link
 * plus a device-local referral record. The missing benefit value is
 * collected for the final report — it is NOT asked of the user here
 * and NOT invented here.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import {
  getOrCreateReferral,
  referralLink,
  shareAppInvite,
} from '../lib/share';
import type { ReferralRecord } from '../lib/share';

export function ReferralScreen() {
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

  const link = record !== null ? referralLink(record.code) : '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.body}>
      <Ionicons name="share-social-outline" size={44} color={colors.primary} />
      <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
        Refer a friend
      </Text>
      <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
        Share your link with friends and family planning a trip. When
        they open it, they land on My Quick Trippers and can talk to the
        team directly.
      </Text>
      {record !== null ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
            Your referral link
          </Text>
          <Text style={[styles.link, { color: colors.primary, fontSize: fs(FONT.body) }]} selectable>
            {link}
          </Text>
          <Text style={[styles.code, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
            Your code: {record.code}
          </Text>
        </View>
      ) : (
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Creating your referral link…
        </Text>
      )}
      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (record !== null) void shareAppInvite(record.code);
        }}
        accessibilityLabel="Share my referral link">
        <Text style={[styles.buttonText, { fontSize: fs(FONT.body) }]}>Share my link</Text>
      </Pressable>
      <View style={[styles.notice, { backgroundColor: colors.estimatedBg }]}>
        <Text style={[styles.text, { color: colors.estimatedText, fontSize: fs(FONT.body) }]}>
          Referral benefit: not announced yet. We are not promising any
          discount, cashback, or coupon for referrals until the business
          defines one — your link works for sharing either way.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  title: { fontWeight: WEIGHT.bold },
  text: { lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.lg, gap: SPACING.sm },
  label: { fontWeight: WEIGHT.bold },
  link: { lineHeight: 22 },
  code: {},
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: RADII.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold },
  notice: { borderRadius: RADII.card, padding: SPACING.lg },
});
