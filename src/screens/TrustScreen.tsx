/**
 * Trust & reviews (v2, Category R items 171–180 + affiliate disclosure 196).
 *
 * HONESTY CONTRACT — every line below is a confirmed fact or an
 * explicitly labelled gap. Do not "improve" this screen by adding a
 * rating, a review, a photo, a response-time promise, or a policy slab:
 * - 171 PARTIAL: no verified review source exists, so no reviews are
 *   displayed. This screen only ACCEPTS review submissions (via the
 *   existing leads channel), labelled "will be verified before display".
 * - 172: Google reviews are a LINK ONLY — no rating, count, or text.
 * - 175: safety notes are GENERIC, labelled as such. No per-hotel or
 *   per-driver details exist.
 * - 176 PARTIAL: slabs are quoted only as "as published on our Terms
 *   page" (the dedicated refund page is gated on business confirmation)
 *   plus a "confirm exact slabs with the team before booking" note.
 * - 177: Razorpay-secured payments only. No trust seals of any kind.
 * - 178 DEFERRED: no traveller photos exist with permission, so none
 *   are shown — and no stock photo is presented as a traveller photo.
 * - 179 DEFERRED: no tracked response-time data exists, so no hours
 *   promise is shown — only contact actions.
 * - 180: report-wrong-info routes via the leads channel; no fix SLA
 *   is promised (none exists).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, submitEnquiry } from '../lib/api';
import {
  CONTACT_PHONE_DISPLAY,
  callAction,
  whatsappAction,
} from '../lib/contact';
import { reviewSubmissionMessage } from '../lib/feedback';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

const TERMS_URL = 'https://www.myquicktrippers.com/terms-and-conditions';
const GOOGLE_SEARCH_URL =
  'https://www.google.com/search?q=My+Quick+Trippers+reviews';

interface Props {
  /** Optional package context (prefills the review form). */
  packageName?: string;
  /** Coordinator-wired: open the ReportIssue screen. Falls back to WhatsApp. */
  onReportIssue?: () => void;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  children: React.ReactNode;
}) {
  const { colors, fs } = useSettings();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors, fs } = useSettings();
  return (
    <Pressable
      style={[
        styles.button,
        primary
          ? { backgroundColor: colors.primary }
          : { borderWidth: 1, borderColor: colors.primary },
      ]}
      onPress={onPress}
      accessibilityLabel={label}>
      <Text
        style={[
          styles.buttonText,
          { fontSize: fs(FONT.body), color: primary ? '#FFFFFF' : colors.primary },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TrustScreen({ packageName, onReportIssue }: Props) {
  const { colors, fs } = useSettings();
  const formRenderedAtRef = useRef(0);
  useEffect(() => {
    formRenderedAtRef.current = Date.now();
  }, []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reviewPackage, setReviewPackage] = useState(packageName ?? '');
  const [tripDate, setTripDate] = useState('');
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmitReview() {
    setError(null);
    if (review.trim() === '') {
      setError('Please write your review before sending it.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitEnquiry(
        {
          name,
          phone,
          packageName: reviewPackage === '' ? undefined : reviewPackage,
          message: reviewSubmissionMessage({
            packageName: reviewPackage === '' ? undefined : reviewPackage,
            tripDate: tripDate === '' ? undefined : tripDate,
            review,
          }),
        },
        formRenderedAtRef.current,
      );
      if (result.ref) {
        setSent(true);
      } else {
        setError(
          'Your review could not be confirmed. Please try again or contact us on WhatsApp.',
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again or contact us on WhatsApp.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.body}>
      <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
        Why travellers trust us
      </Text>
      <Text style={[styles.intro, { color: colors.muted, fontSize: fs(FONT.body) }]}>
        Real people, real contact details, and honest labels where we do
        not have verified data yet. Nothing on this page is dressed up.
      </Text>

      <Section icon="people-outline" title="Talk to the team">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Amit Sajwan — sales and operations. Vidish Bijalwan — tech and
          support. Two people, not a call centre: when you call{' '}
          {CONTACT_PHONE_DISPLAY}, you reach the team that runs your trip.
        </Text>
        <ActionButton label={`Call ${CONTACT_PHONE_DISPLAY}`} onPress={() => void callAction()} primary />
        <ActionButton
          label="WhatsApp the team"
          onPress={() => void whatsappAction('Hi My Quick Trippers! I have a question about a trip.')}
        />
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          We do not display a reply-time promise: we have no tracked
          response-time data, so we will not guess at one. Call or
          WhatsApp us directly and we will get back to you.
        </Text>
      </Section>

      <Section icon="shield-checkmark-outline" title="Business credentials">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          My Quick Trippers is a registered proprietorship, registered in
          2019, with GST and Udyam registration. Registration numbers are
          not shown in the app — ask the team and they will share them.
        </Text>
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Contact: {CONTACT_PHONE_DISPLAY} · myquicktrippers.com
        </Text>
      </Section>

      <Section icon="medkit-outline" title="Safety on your trip">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          These are general safety notes for every trip — not promises
          about a specific hotel or driver, which we confirm per booking:
        </Text>
        <Text style={[styles.bullet, { color: colors.text, fontSize: fs(FONT.body) }]}>
          · Keep the team&apos;s number saved: {CONTACT_PHONE_DISPLAY} — call
          us any time during your trip if anything feels off.
        </Text>
        <Text style={[styles.bullet, { color: colors.text, fontSize: fs(FONT.body) }]}>
          · Carry ID and your booking reference; share your itinerary with
          family before you leave.
        </Text>
        <Text style={[styles.bullet, { color: colors.text, fontSize: fs(FONT.body) }]}>
          · For hill and pilgrimage routes, follow local advisories and
          your driver&apos;s guidance on weather and road conditions.
        </Text>
        <Text style={[styles.bullet, { color: colors.text, fontSize: fs(FONT.body) }]}>
          · Ask the team about insurance options before booking — options
          depend on your trip and are confirmed on callback.
        </Text>
      </Section>

      <Section icon="document-text-outline" title="Cancellation & refunds">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Cancellation slabs are as published on our Terms page on the
          website. Please read the Terms page for the slabs that apply to
          your booking — and confirm the exact slabs with the team before
          you book, since they depend on the booking.
        </Text>
        <ActionButton label="Read the Terms page" onPress={() => void Linking.openURL(TERMS_URL)} />
        <ActionButton
          label="Confirm slabs on WhatsApp"
          onPress={() =>
            void whatsappAction(
              'Hi My Quick Trippers! Please confirm the exact cancellation and refund slabs for my booking before I pay.',
            )
          }
        />
      </Section>

      <Section icon="lock-closed-outline" title="Secure payments">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Payments in this app are secured by Razorpay. We never see your
          card number or UPI PIN, and every receipt carries the payment
          and order IDs. We show no other trust seals — only this one,
          because it is the one that is real.
        </Text>
      </Section>

      <Section icon="star-outline" title="Traveller reviews">
        <EmptyState
          icon="star-outline"
          title="No verified reviews to show yet"
          message="We only show reviews from real booked travellers, and we do not have a verified review display yet — so this space stays empty rather than showing unverified ratings."
          actionLabel="Write a review"
          onAction={() => setReviewPackage(reviewPackage)}
        />
        <ActionButton label="See reviews on Google" onPress={() => void Linking.openURL(GOOGLE_SEARCH_URL)} />
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          We show no rating or review count here — we do not have verified
          rating data to display. The Google link opens Google&apos;s own
          reviews page.
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          Traveller photos are not shown either: we have no traveller
          photos with permission to publish, and we will never present
          stock photos as traveller photos.
        </Text>
      </Section>

      <Section icon="create-outline" title="Write a review">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Travelled with us? Send your review here. Your review will be
          verified before display — it will not appear publicly until the
          team has checked it.
        </Text>
        {sent ? (
          <View style={[styles.sentBox, { backgroundColor: colors.successBg }]}>
            <Text style={[styles.text, { color: colors.successText, fontSize: fs(FONT.body) }]}>
              Thank you! Your review has been sent for verification. It
              will only be displayed after the team checks it.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Your name *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.placeholderText}
            />
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Phone *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit Indian mobile"
              placeholderTextColor={colors.placeholderText}
              keyboardType="phone-pad"
            />
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Package (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
              value={reviewPackage}
              onChangeText={setReviewPackage}
              placeholder="Which trip was this?"
              placeholderTextColor={colors.placeholderText}
            />
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Trip date (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
              value={tripDate}
              onChangeText={setTripDate}
              placeholder="e.g. October 2026"
              placeholderTextColor={colors.placeholderText}
            />
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Your review *</Text>
            <TextInput
              style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
              value={review}
              onChangeText={setReview}
              placeholder="How was your trip?"
              placeholderTextColor={colors.placeholderText}
              multiline
            />
            {error !== null ? (
              <ErrorState message={error} onRetry={handleSubmitReview} retryLabel="Try sending again" />
            ) : null}
            <ActionButton
              label={submitting ? 'Sending…' : 'Send review for verification'}
              onPress={() => void handleSubmitReview()}
              primary
            />
          </>
        )}
      </Section>

      <Section icon="information-circle-outline" title="Affiliate transparency">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Some links on this site and in our articles are affiliate links:
          if you buy through them, we may earn a small commission at no
          extra cost to you. Affiliate links are always labelled as such,
          exactly as on the website — we never hide that a link earns us
          a commission.
        </Text>
      </Section>

      <Section icon="flag-outline" title="Spot something wrong?">
        <Text style={[styles.text, { color: colors.text, fontSize: fs(FONT.body) }]}>
          Found a wrong price, photo, or detail in the app? Tell the team
          and quote the package — your report goes straight to them. We
          do not promise a fix time; the team will check it and get back
          to you.
        </Text>
        <ActionButton
          label="Report wrong info"
          onPress={() => {
            if (onReportIssue !== undefined) {
              onReportIssue();
            } else {
              void whatsappAction(
                'Hi My Quick Trippers! I spotted something wrong in the app. Details: ',
              );
            }
          }}
          primary
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.lg },
  title: { fontWeight: WEIGHT.bold },
  intro: { lineHeight: 22 },
  section: { gap: SPACING.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionTitle: { fontWeight: WEIGHT.bold },
  text: { lineHeight: 22 },
  bullet: { lineHeight: 22, paddingLeft: SPACING.sm },
  note: { lineHeight: 19 },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.sm },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    minHeight: TOUCH_MIN,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: RADII.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  buttonText: { fontWeight: WEIGHT.bold },
  sentBox: { borderRadius: RADII.card, padding: SPACING.lg },
});
