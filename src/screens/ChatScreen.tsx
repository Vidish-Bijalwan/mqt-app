/**
 * Chat tab (v1.2). HONEST MESSAGING — READ BEFORE EDITING:
 * There is no two-way inbox and no live chat in this app: no team inbox
 * UI exists, so no fake replies, typing indicators, or canned answers
 * presented as live chat are ever rendered here. A message sent here is
 * submitted as an enquiry via submitEnquiry (prefixed 'App chat' with
 * package/booking context) and the team replies via WhatsApp or a
 * callback. The empty state and the success state both say exactly that.
 * The FAQ section below is CLEARLY LABELED 'Frequently asked questions'
 * and is static help text, never presented as a live conversation. Its
 * answers use only verified business facts: payments via Razorpay;
 * cancellations follow the site Terms page (no slabs hardcoded — slabs
 * are not verified here); Char Dham permits vary by season (ask the
 * team); contact +91-8171158569. No invented figures or policies.
 * DEFERRED: a two-way inbox (no team inbox UI exists).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ApiError, submitEnquiry } from '../lib/api';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  whatsappAction,
} from '../lib/contact';
import { CHAT_DRAFT_KEY, loadProfile } from '../lib/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'Chat'>;

const SITE = 'https://www.myquicktrippers.com';
const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening'] as const;

const FAQS = [
  {
    q: 'How do I pay for a trip?',
    a: 'Payments are taken securely via Razorpay on the Pay screen, or through the link the team shares with you. No payment is taken from this chat screen.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancellations follow the Terms page on the website. Please read it before booking, or ask the team about your specific trip — no cancellation charges are stated here because they depend on the booking.',
    link: { label: 'Read the Terms page', url: `${SITE}/terms-and-conditions` },
  },
  {
    q: 'Do I need permits for Char Dham?',
    a: 'Char Dham permits vary by season. Ask the team about the current season’s requirements for your travel dates and they will confirm what applies to you.',
  },
  {
    q: 'How do I contact the team directly?',
    a: `Call or WhatsApp the team on ${CONTACT_PHONE_DISPLAY}. If we miss your call, send a message and we will call back.`,
  },
] as const;

export function ChatScreen({ route }: Props) {
  const params = route.params ?? {};
  const { colors, fs, t } = useSettings();
  // v2.0.2 banner only: the composer below is untouched. The tab
  // navigator does not own SupportChat, so navigate via the parent
  // stack (cast, same pattern as TripsScreen's planner navigation).
  const tabNavigation = useNavigation();
  const openInstantChat = () => {
    (tabNavigation.navigate as unknown as (r: string, p?: object) => void)(
      'SupportChat',
      {},
    );
  };
  const formRenderedAtRef = useRef(0);
  useEffect(() => {
    formRenderedAtRef.current = Date.now();
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);

  // Callback scheduling state.
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackSlot, setCallbackSlot] = useState<string | null>(null);
  const [callbackSending, setCallbackSending] = useState(false);
  const [callbackRef, setCallbackRef] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  // Prefill name/phone from the locally stored profile; restore the
  // unsent draft (message only — name/phone come from the profile).
  useEffect(() => {
    let alive = true;
    (async () => {
      const [profile, draft] = await Promise.all([
        loadProfile(),
        AsyncStorage.getItem(CHAT_DRAFT_KEY).catch(() => null),
      ]);
      if (!alive) return;
      if (profile.name) setName(profile.name);
      if (profile.phone) setPhone(profile.phone);
      if (draft) setMessage(draft);
      setDraftLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Save the draft locally as the user types (device only).
  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(CHAT_DRAFT_KEY, message).catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [message, draftLoaded]);

  const contextLine = [
    params.packageName ? `about "${params.packageName}"` : null,
    params.ref ? `trip ref ${params.ref}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  async function handleSend() {
    setError(null);
    setSubmitting(true);
    try {
      const contextSuffix = contextLine ? ` (${contextLine})` : '';
      const result = await submitEnquiry(
        {
          name,
          phone,
          packageSlug: params.slug,
          packageName: params.packageName,
          message: `App chat${contextSuffix}: ${message.trim()}`,
        },
        formRenderedAtRef.current,
      );
      if (result.ref) {
        setSentRef(result.ref);
        await AsyncStorage.removeItem(CHAT_DRAFT_KEY).catch(() => undefined);
      } else {
        setError(
          'Your request could not be confirmed. Please try again or contact us on WhatsApp.',
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

  async function handleCallbackRequest() {
    setCallbackError(null);
    if (!name.trim() || !phone.trim()) {
      setCallbackError('Please enter your name and phone above first.');
      return;
    }
    if (!callbackDate.trim() || callbackSlot === null) {
      setCallbackError('Please pick a date and a time slot.');
      return;
    }
    setCallbackSending(true);
    try {
      const result = await submitEnquiry(
        {
          name,
          phone,
          packageSlug: params.slug,
          packageName: params.packageName,
          message: `Callback requested: ${callbackDate.trim()} ${callbackSlot}`,
        },
        formRenderedAtRef.current,
      );
      if (result.ref) setCallbackRef(result.ref);
      else
        setCallbackError(
          'Your request could not be confirmed. Please try again or contact us on WhatsApp.',
        );
    } catch (err) {
      setCallbackError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again or contact us on WhatsApp.',
      );
    } finally {
      setCallbackSending(false);
    }
  }

  const canSend =
    name.trim().length >= 2 && phone.trim() !== '' && message.trim() !== '';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {t('chatTitle')}
        </Text>

        {/*
         * v2.0.2 banner (composer below untouched): instant chat is a
         * real API conversation on the SupportChat screen, not a
         * replacement for this message-the-team form.
         */}
        <Pressable
          style={[styles.instantBanner, { borderColor: colors.primary }]}
          onPress={openInstantChat}
          accessibilityLabel="Open instant support chat">
          <Text style={[styles.instantBannerText, { color: colors.primary, fontSize: fs(FONT.body) }]}>
            Want instant answers? Try MQT Support instant chat →
          </Text>
        </Pressable>

        {params.packageName ? (
          <View style={[styles.contextBox, { backgroundColor: colors.estimatedBg }]}>
            <Text style={[styles.contextText, { color: colors.text, fontSize: fs(FONT.body) }]}>
              Chatting about: {params.packageName}
              {params.ref ? ` (ref: ${params.ref})` : ''}
            </Text>
          </View>
        ) : null}

        <View style={[styles.emptyBox, { borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.text, fontSize: fs(FONT.body) }]}>
            {t('chatEmpty')}
          </Text>
        </View>

        {sentRef !== null ? (
          <View style={[styles.successBox, { backgroundColor: colors.estimatedBg }]}>
            <Text style={[styles.successTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Message sent — ref {sentRef}
            </Text>
            <Text style={[styles.successText, { color: colors.text, fontSize: fs(FONT.body) }]}>
              The team will reply via WhatsApp or a callback. Keep this
              reference handy.
            </Text>
            <Pressable
              style={[styles.button, styles.whatsappButton]}
              onPress={() =>
                whatsappAction(
                  `Hi My Quick Trippers! I sent an app chat message (ref: ${sentRef})${contextLine ? ` ${contextLine}` : ''}. Please reply when you can.`,
                )
              }>
              <Text style={styles.buttonText}>Continue on WhatsApp</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="words"
            />
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Phone *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Mobile number"
              placeholderTextColor={colors.placeholderText}
              keyboardType="phone-pad"
            />
            <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Message *</Text>
            <TextInput
              style={[styles.input, styles.messageInput, { borderColor: colors.border, color: colors.text }]}
              value={message}
              onChangeText={setMessage}
              placeholder="Ask about a trip, dates, or anything else…"
              placeholderTextColor={colors.placeholderText}
              multiline
            />
            <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
              Your draft is saved on this device only until you send it.
            </Text>
            {error !== null ? (
              <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
                <Text style={[styles.errorText, { color: colors.errorText, fontSize: fs(FONT.body) }]}>{error}</Text>
              </View>
            ) : null}
            <Pressable
              style={[styles.button, styles.primaryButton, !canSend || submitting ? styles.disabled : null]}
              onPress={handleSend}
              disabled={!canSend || submitting}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{t('send')} message to the team</Text>
              )}
            </Pressable>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Schedule a callback
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Pick a preferred date and time of day and the team will call you
          back. This is a request, not a confirmed appointment.
        </Text>
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Preferred date</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={callbackDate}
          onChangeText={setCallbackDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="none"
        />
        <View style={styles.slotRow}>
          {TIME_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              style={[
                styles.slot,
                {
                  borderColor: callbackSlot === slot ? colors.primary : colors.border,
                  backgroundColor: callbackSlot === slot ? colors.primary : colors.background,
                },
              ]}
              onPress={() => setCallbackSlot(slot)}>
              <Text
                style={[
                  styles.slotText,
                  { color: callbackSlot === slot ? '#FFFFFF' : colors.text },
                ]}>
                {slot}
              </Text>
            </Pressable>
          ))}
        </View>
        {callbackRef !== null ? (
          <Text style={[styles.successText, { color: colors.text, fontSize: fs(FONT.body) }]}>
            Callback requested — ref {callbackRef}. The team will call you
            back at your preferred time.
          </Text>
        ) : null}
        {callbackError !== null ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
            <Text style={[styles.errorText, { color: colors.errorText, fontSize: fs(FONT.body) }]}>{callbackError}</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.button, styles.primaryButton, callbackSending ? styles.disabled : null]}
          onPress={handleCallbackRequest}
          disabled={callbackSending}>
          {callbackSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Request callback</Text>
          )}
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {t('chatFaq')}
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          These are answers to common questions — this section is not a
          live chat.
        </Text>
        {FAQS.map((faq) => (
          <View key={faq.q} style={[styles.faq, { borderColor: colors.border }]}>
            <Text style={[styles.faqQ, { color: colors.text, fontSize: fs(FONT.body) }]}>{faq.q}</Text>
            <Text style={[styles.faqA, { color: colors.muted, fontSize: fs(FONT.body) }]}>{faq.a}</Text>
            {'link' in faq && faq.link ? (
              <Pressable onPress={() => Linking.openURL(faq.link.url)}>
                <Text style={[styles.faqLink, { color: colors.primary, fontSize: fs(FONT.body) }]}>{faq.link.label}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Prefer to talk now?
        </Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={callAction}>
          <Text style={styles.buttonText}>Call {CONTACT_PHONE_DISPLAY}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() => whatsappAction('Hi My Quick Trippers! I need help with my trip.')}>
          <Text style={styles.buttonText}>WhatsApp the team</Text>
        </Pressable>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          If we miss your call, send a message and we will call back.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  contextBox: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADII.card },
  contextText: { lineHeight: 22 },
  emptyBox: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADII.card,
  },
  emptyText: { lineHeight: 22 },
  successBox: { marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADII.card },
  successTitle: { fontWeight: WEIGHT.bold },
  successText: { marginTop: SPACING.sm, lineHeight: 22 },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.lg },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: SPACING.sm,
  },
  messageInput: { minHeight: 110, textAlignVertical: 'top' },
  note: { marginTop: SPACING.sm, lineHeight: 20 },
  errorBox: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADII.button },
  errorText: { lineHeight: 20 },
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
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  slotRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  slot: {
    flex: 1,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADII.button,
  },
  slotText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  instantBanner: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  instantBannerText: { fontWeight: WEIGHT.bold, lineHeight: 20 },
  faq: { borderBottomWidth: 1, paddingVertical: SPACING.md },
  faqQ: { fontWeight: WEIGHT.bold },
  faqA: { marginTop: SPACING.xs, lineHeight: 22 },
  faqLink: { marginTop: SPACING.xs, fontWeight: WEIGHT.bold },
});
