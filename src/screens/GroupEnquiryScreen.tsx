/**
 * Group / school / corporate enquiry (v2 items 192 + 198).
 *
 * Routes into the EXISTING enquiry flow (submitEnquiry → Leads table)
 * with a group-type flag. Bulk pricing is always "ask the team" — no
 * slabs exist, so none are stated. School/corporate submissions carry
 * a GST-invoicing note for the team to confirm; no GST number or rate
 * is stated (none is confirmed for display here).
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
import { corporateEnquiryMessage, groupEnquiryMessage, returningTravellerNote } from '../lib/feedback';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { ErrorState } from '../components/ErrorState';

type Kind = 'school' | 'corporate' | 'family' | 'other';

const KINDS: { id: Kind; label: string }[] = [
  { id: 'school', label: 'School trip' },
  { id: 'corporate', label: 'Corporate trip' },
  { id: 'family', label: 'Family / friends group' },
  { id: 'other', label: 'Other group' },
];

interface Props {
  packageName?: string;
}

export function GroupEnquiryScreen({ packageName }: Props) {
  const { colors, fs } = useSettings();
  const formRenderedAtRef = useRef(0);
  useEffect(() => {
    formRenderedAtRef.current = Date.now();
  }, []);
  const [kind, setKind] = useState<Kind>('school');
  const [org, setOrg] = useState('');
  const [size, setSize] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
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
    setSubmitting(true);
    try {
      const message =
        kind === 'school' || kind === 'corporate'
          ? corporateEnquiryMessage({
              organisation: org,
              tripKind: kind,
              groupSize: size,
              notes,
            })
          : groupEnquiryMessage({
              packageName,
              groupSize: size,
              groupKind: kind,
            });
      const result = await submitEnquiry(
        {
          name,
          phone,
          packageName,
          message,
        },
        formRenderedAtRef.current,
      );
      if (result.ref) setSent(true);
      else
        setError(
          'Your enquiry could not be confirmed. Please try again or contact us on WhatsApp.',
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
        Group & school / corporate trips
      </Text>
      <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
        Travelling as a group? Tell us about it and the team will share
        group pricing on callback — there are no fixed group slabs to
        show yet. For school and corporate trips, ask about GST
        invoicing in your enquiry and the team will confirm the details.
      </Text>
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
            Thank you! Your group enquiry has been sent. The team will
            call you back with group pricing.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Group type</Text>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable
                key={k.id}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: kind === k.id ? colors.primary : colors.card,
                  },
                ]}
                onPress={() => setKind(k.id)}
                accessibilityLabel={k.label}>
                <Text
                  style={[
                    styles.chipText,
                    { color: kind === k.id ? '#FFFFFF' : colors.text, fontSize: fs(FONT.meta) },
                  ]}>
                  {k.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {(kind === 'school' || kind === 'corporate') ? (
            <>
              <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>School / organisation name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
                value={org}
                onChangeText={setOrg}
                placeholder="e.g. Delhi Public School"
                placeholderTextColor={colors.placeholderText}
              />
            </>
          ) : null}
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Approx. group size</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={size}
            onChangeText={setSize}
            placeholder="e.g. 50"
            placeholderTextColor={colors.placeholderText}
            keyboardType="number-pad"
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
          <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.meta) }]}>Anything else (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg, fontSize: fs(FONT.body) }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Dates, destination, anything the team should know"
            placeholderTextColor={colors.placeholderText}
            multiline
          />
          {error !== null ? (
            <ErrorState message={error} onRetry={handleSubmit} retryLabel="Try sending again" />
          ) : null}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => void handleSubmit()}
            accessibilityLabel="Send group enquiry">
            <Text style={[styles.buttonText, { fontSize: fs(FONT.body) }]}>
              {submitting ? 'Sending…' : 'Send group enquiry'}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
  },
  chipText: { fontWeight: WEIGHT.medium },
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
