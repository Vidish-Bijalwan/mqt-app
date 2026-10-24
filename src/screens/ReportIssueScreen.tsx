/**
 * Report wrong info (v2 item 180). Routes to the team via the existing
 * leads channel (submitEnquiry) with the package reference attached.
 * NO fix SLA is promised anywhere — none exists.
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
import { reportIssueMessage } from '../lib/feedback';
import { whatsappAction } from '../lib/contact';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { ErrorState } from '../components/ErrorState';

interface Props {
  packageName?: string;
  packageRef?: string;
}

export function ReportIssueScreen({ packageName, packageRef }: Props) {
  const { colors, fs } = useSettings();
  const formRenderedAtRef = useRef(0);
  useEffect(() => {
    formRenderedAtRef.current = Date.now();
  }, []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pkg, setPkg] = useState(packageName ?? '');
  const [ref, setRef] = useState(packageRef ?? '');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (details.trim() === '') {
      setError('Please describe what is wrong before sending.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitEnquiry(
        {
          name,
          phone,
          packageName: pkg === '' ? undefined : pkg,
          message: reportIssueMessage({
            packageName: pkg === '' ? undefined : pkg,
            packageRef: ref === '' ? undefined : ref,
            details,
          }),
        },
        formRenderedAtRef.current,
      );
      if (result.ref) setSent(true);
      else
        setError(
          'Your report could not be confirmed. Please try again or contact us on WhatsApp.',
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
        Report wrong info
      </Text>
      <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
        Spotted a wrong price, photo, or detail? Tell us here and quote
        the package so the team can find it. Your report goes straight
        to the team — we do not promise a fix time, but the team will
        check it.
      </Text>
      {sent ? (
        <View style={[styles.sentBox, { backgroundColor: colors.successBg }]}>
          <Text style={[styles.text, { color: colors.successText, fontSize: fs(FONT.body) }]}>
            Thank you! Your report has been sent to the team. They will
            check the details you shared.
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
            value={pkg}
            onChangeText={setPkg}
            placeholder="Which package is this about?"
            placeholderTextColor={colors.placeholderText}
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Booking / enquiry reference (optional)</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={ref}
            onChangeText={setRef}
            placeholder="Reference, if you have one"
            placeholderTextColor={colors.placeholderText}
          />
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>What is wrong? *</Text>
          <TextInput
            style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={details}
            onChangeText={setDetails}
            placeholder="e.g. The price on this package does not match the website"
            placeholderTextColor={colors.placeholderText}
            multiline
          />
          {error !== null ? (
            <ErrorState message={error} onRetry={handleSubmit} retryLabel="Try sending again" />
          ) : null}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => void handleSubmit()}
            accessibilityLabel="Send report">
            <Text style={[styles.buttonText, { fontSize: fs(FONT.body) }]}>
              {submitting ? 'Sending…' : 'Send report'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondary, { borderColor: colors.primary }]}
            onPress={() =>
              void whatsappAction(
                `Hi My Quick Trippers! I spotted something wrong in the app${pkg !== '' ? ` on "${pkg}"` : ''}. Details: ${details}`,
              )
            }
            accessibilityLabel="Report on WhatsApp instead">
            <Text style={[styles.buttonText, { color: colors.primary, fontSize: fs(FONT.body) }]}>
              Report on WhatsApp instead
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
  secondary: { borderWidth: 1 },
  buttonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold },
  sentBox: { borderRadius: RADII.card, padding: SPACING.lg },
});
