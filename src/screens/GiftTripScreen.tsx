/**
 * Gift a trip (v2 item 199). Mechanism only: a gift message card plus
 * an enquiry prefill flagged as a gift, using the normal enquiry/pay
 * flow afterwards. No gift pricing exists — the team confirms the
 * final quote on callback; nothing here states a gift price.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, submitEnquiry } from '../lib/api';
import { giftEnquiryMessage, returningTravellerNote } from '../lib/feedback';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { ErrorState } from '../components/ErrorState';

interface Props {
  packageName?: string;
}

export function GiftTripScreen({ packageName }: Props) {
  const { colors, fs } = useSettings();
  const formRenderedAtRef = useRef(0);
  useEffect(() => {
    formRenderedAtRef.current = Date.now();
  }, []);
  const [pkg, setPkg] = useState(packageName ?? '');
  const [recipient, setRecipient] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [returningNote, setReturningNote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void returningTravellerNote().then((n) => {
      if (alive) setReturningNote(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit() {
    setError(null);
    if (giftMessage.trim() === '' || pkg.trim() === '') {
      setError('Please choose a package and write your gift message.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitEnquiry(
        {
          name,
          phone,
          packageName: pkg,
          message: giftEnquiryMessage({
            packageName: pkg,
            giftMessage,
            recipientName: recipient === '' ? undefined : recipient,
          }),
        },
        formRenderedAtRef.current,
      );
      if (result.ref) setSent(true);
      else
        setError(
          'Your gift enquiry could not be confirmed. Please try again or contact us on WhatsApp.',
        );
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
        Gift a trip
      </Text>
      <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
        Surprise someone with a trip. Write your message card here and
        the team will confirm the final quote — payment then follows the
        normal secure pay flow.
      </Text>
      {giftMessage.trim() !== '' ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.cardLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
            Your gift message card
          </Text>
          <Text style={[styles.cardText, { color: colors.text, fontSize: fs(FONT.body) }]}>
            {giftMessage}
          </Text>
          {recipient.trim() !== '' ? (
            <Text style={[styles.cardText, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
              For: {recipient}
            </Text>
          ) : null}
        </View>
      ) : null}
      {returningNote !== null ? (
        <View style={[styles.sentBox, { backgroundColor: colors.successBg }]}>
          <Text style={[styles.text, { color: colors.successText, fontSize: fs(FONT.body) }]}>
            {returningNote} As a returning traveller, the team gives your
            enquiry priority support.
          </Text>
        </View>
      ) : null}
      {sent ? (
        <View style={[styles.sentBox, { backgroundColor: colors.successBg }]}>
          <Text style={[styles.text, { color: colors.successText, fontSize: fs(FONT.body) }]}>
            Thank you! Your gift enquiry has been sent. The team will call
            you back with the final quote.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Package *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={pkg}
            onChangeText={setPkg}
            placeholder="Which trip are you gifting?"
            placeholderTextColor={colors.placeholderText}
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>For whom? (optional)</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Recipient's name"
            placeholderTextColor={colors.placeholderText}
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Your gift message *</Text>
          <TextInput
            style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={giftMessage}
            onChangeText={setGiftMessage}
            placeholder="Write your message for the traveller…"
            placeholderTextColor={colors.placeholderText}
            multiline
          />
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
          {error !== null ? (
            <ErrorState message={error} onRetry={handleSubmit} retryLabel="Try sending again" />
          ) : null}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => void handleSubmit()}
            accessibilityLabel="Send gift enquiry">
            <Text style={[styles.buttonText, { fontSize: fs(FONT.body) }]}>
              {submitting ? 'Sending…' : 'Send gift enquiry'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  title: { fontWeight: WEIGHT.bold },
  text: { lineHeight: 22 },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.sm },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.lg, gap: SPACING.sm },
  cardLabel: { fontWeight: WEIGHT.bold },
  cardText: { lineHeight: 22 },
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
    marginTop: SPACING.md,
  },
  buttonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold },
  sentBox: { borderRadius: RADII.card, padding: SPACING.lg },
});
