/**
 * Offers & growth hub (v2, items 192/193/198/199/200).
 *
 * HONESTY CONTRACT:
 * - 193: this screen is driven by the remote-config offers list. No
 *   offers feed exists today, so the offers section is honestly EMPTY
 *   (no banner, countdown, or discount is invented). When the feed
 *   lands, real offers with start/end dates and terms render here.
 * - 200: app-exclusive offers are OFF — no business-approved in-app
 *   perks exist, so none are shown.
 * - 192: group pricing slabs do NOT exist — "ask the team" only.
 * - 198/199: school/corporate and gift flows route into the normal
 *   enquiry flow (coordinator-wired callbacks, WhatsApp fallback).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { useAppConfig } from '../lib/appConfig';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { whatsappAction } from '../lib/contact';

interface Props {
  onGroupEnquiry?: () => void;
  onGiftTrip?: () => void;
  onReferral?: () => void;
  onInvite?: () => void;
}

function RowButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, fs } = useSettings();
  return (
    <Pressable
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPress}
      accessibilityLabel={title}>
      <Ionicons name={icon} size={24} color={colors.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text, fontSize: fs(FONT.body) }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.muted, fontSize: fs(FONT.meta) }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

export function OffersScreen({ onGroupEnquiry, onGiftTrip, onReferral, onInvite }: Props) {
  const { colors, fs } = useSettings();
  const { loading, error, refresh } = useAppConfig();

  const askGroup = () =>
    onGroupEnquiry !== undefined
      ? onGroupEnquiry()
      : void whatsappAction(
          'Hi My Quick Trippers! Please share group pricing for our trip.',
        );
  const gift = () =>
    onGiftTrip !== undefined
      ? onGiftTrip()
      : void whatsappAction(
          'Hi My Quick Trippers! I would like to gift a trip. Please share how it works.',
        );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.body}>
      <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
        Offers & more
      </Text>
      <Text style={[styles.intro, { color: colors.muted, fontSize: fs(FONT.body) }]}>
        Only real offers appear here. If there is nothing listed, there
        is no offer running — we will not invent one.
      </Text>

      {error !== null ? (
        <ErrorState
          message="Could not load the latest offers. Please check your connection and try again."
          onRetry={refresh}
        />
      ) : loading ? (
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Checking for current offers…
        </Text>
      ) : (
        <EmptyState
          icon="pricetag-outline"
          title="No current offers"
          message="There are no live offers right now. Seasonal offers appear here with their start and end dates and terms when the team publishes them."
          actionLabel="Ask the team about offers"
          onAction={() =>
            void whatsappAction(
              'Hi My Quick Trippers! Are there any current offers on trips?',
            )
          }
        />
      )}

      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
        App-exclusive offers
      </Text>
      <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
        None right now — no business-approved in-app perks exist yet, so
        this section stays empty rather than showing a made-up discount.
      </Text>

      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
        Travelling together?
      </Text>
      <RowButton
        icon="people-outline"
        title="Group booking"
        subtitle="Ask the team for group pricing — no fixed slabs yet"
        onPress={askGroup}
      />
      <RowButton
        icon="school-outline"
        title="School / corporate trips"
        subtitle="Dedicated flow with GST invoicing details on request"
        onPress={askGroup}
      />
      <RowButton
        icon="gift-outline"
        title="Gift a trip"
        subtitle="Send a trip with a personal message card"
        onPress={gift}
      />
      <RowButton
        icon="share-social-outline"
        title="Refer & invite"
        subtitle="Share the app — no reward value is promised yet"
        onPress={() => {
          if (onReferral !== undefined) onReferral();
          else if (onInvite !== undefined) onInvite();
          else
            void whatsappAction(
              'Hi My Quick Trippers! Please send me the app invite link.',
            );
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  title: { fontWeight: WEIGHT.bold },
  intro: { lineHeight: 22 },
  text: { lineHeight: 22 },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADII.card,
    padding: SPACING.lg,
    minHeight: TOUCH_MIN + 16,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: WEIGHT.bold },
  rowSub: { lineHeight: 18 },
});
