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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BRAND } from '../constants';
import { ApiError, submitEnquiry } from '../lib/api';
import type { EnquiryInput } from '../lib/api';
import { whatsappUrl } from '../lib/contact';
import {
  clearEnquiryFormDraft,
  loadEnquiryFormDraft,
  queueEnquiry,
  saveEnquiryFormDraft,
} from '../lib/drafts';
import { loadProfile } from '../lib/settings';
import { saveTrip } from '../lib/trips';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Enquiry'>;

export function EnquiryScreen({ route, navigation }: Props) {
  const { slug, packageName, travelerCount, travelerNames, contactPref } =
    route.params;
  // Captured when the form mounted (server anti-spam field).
  const formRenderedAtRef = useRef(0);
  // Captured after mount (server anti-spam field); submission always
  // happens after mount, so the effect has run by then.
  useEffect(() => {
    formRenderedAtRef.current = Date.now();
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [travellers, setTravellers] = useState(
    travelerCount !== undefined ? String(travelerCount) : '',
  );
  const [message, setMessage] = useState('');

  // v1.2: prefill name/phone/email from the locally stored Account
  // profile (only fills fields the user has not typed into yet).
  useEffect(() => {
    let alive = true;
    loadProfile().then((profile) => {
      if (!alive) return;
      if (profile.name) setName((prev) => prev || profile.name);
      if (profile.phone) setPhone((prev) => prev || profile.phone);
      if (profile.email) setEmail((prev) => prev || profile.email);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  // v2 items 152/156: restore a half-filled form after kill/crash, then
  // autosave on every change. The ready flag prevents the mount-time
  // autosave (empty fields) from wiping the stored draft before the
  // restore load resolves. Only a draft for THIS package is restored.
  const draftReadyRef = useRef(false);
  useEffect(() => {
    let alive = true;
    loadEnquiryFormDraft().then((draft) => {
      if (!alive) return;
      if (draft !== null && draft.slug === slug) {
        if (draft.name !== '') setName(draft.name);
        if (draft.phone !== '') setPhone(draft.phone);
        if (draft.email !== '') setEmail(draft.email);
        if (draft.travelDate !== '') setTravelDate(draft.travelDate);
        if (draft.travellers !== '') setTravellers(draft.travellers);
        if (draft.message !== '') setMessage(draft.message);
      }
      draftReadyRef.current = true;
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  useEffect(() => {
    if (!draftReadyRef.current) return;
    void saveEnquiryFormDraft({
      slug,
      packageName,
      name,
      phone,
      email,
      travelDate,
      travellers,
      message,
    });
  }, [name, phone, email, travelDate, travellers, message, slug, packageName]);

  const whatsappMessage =
    ref !== null
      ? `Hi My Quick Trippers! I just submitted an enquiry for "${packageName}" (ref: ${ref}). My name is ${name.trim() || '—'}. Please call me back.`
      : `Hi My Quick Trippers! I would like to enquire about the "${packageName}" package. My name is ${name.trim() || '—'}. Please call me back.`;

  async function handleSubmit() {
    setError(null);
    setQueued(false);
    const travellersNumber =
      travellers.trim() === '' ? undefined : Number(travellers.trim());
    // v1.2: append the preferred-contact line (and traveler names, when
    // passed) to the submitted message; existing params keep working.
    const messageParts = [message.trim()];
    if (travelerNames !== undefined && travelerNames.trim() !== '') {
      messageParts.push(`Travellers: ${travelerNames.trim()}`);
    }
    if (contactPref !== undefined && contactPref.trim() !== '') {
      messageParts.push(`Preferred contact: ${contactPref.trim()}`);
    }
    const finalMessage = messageParts.filter((p) => p !== '').join('\n');
    const input: EnquiryInput = {
      name,
      phone,
      email: email === '' ? undefined : email,
      packageSlug: slug,
      packageName,
      travelDate: travelDate === '' ? undefined : travelDate,
      travellers: travellersNumber,
      message: finalMessage === '' ? undefined : finalMessage,
    };
    setSubmitting(true);
    try {
      const result = await submitEnquiry(input, formRenderedAtRef.current);
      if (result.ref) {
        setRef(result.ref);
        // Best-effort: save to device-local My Trips. A storage failure
        // must never block or roll back a successful submission.
        try {
          await saveTrip({
            slug,
            packageName,
            ref: result.ref,
            date: new Date().toISOString(),
          });
        } catch {
          // Ignored on purpose — the enquiry itself already succeeded.
        }
        // The submitted form is done — drop its autosaved draft.
        try {
          await clearEnquiryFormDraft();
        } catch {
          // Ignored on purpose.
        }
      } else {
        // Spam-filtered response ({ok:true, id:null, ref:null}): the server
        // accepted but did not store a lead, so do not show a success screen.
        setError(
          'Your request could not be confirmed. Please try again or contact us on WhatsApp.',
        );
      }
    } catch (err) {
      // v2 item 152: a transport-level failure queues the enquiry in the
      // device-local outbox (retried on foreground return + manually
      // from Offline & diagnostics). Validation-style ApiErrors are NOT
      // queued — resending them would just repeat the same rejection.
      const looksNetwork =
        !(err instanceof ApiError) ||
        /network|fetch|timeout|timed out|offline|connection|socket|econn/i.test(
          err.message,
        );
      if (looksNetwork) {
        try {
          await queueEnquiry(input, formRenderedAtRef.current);
          setQueued(true);
          setError(
            'Could not reach the server. Your enquiry is saved in your outbox and will send automatically when you are back online.',
          );
        } catch {
          setError('Something went wrong. Please try again or contact us on WhatsApp.');
        }
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again or contact us on WhatsApp.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (ref !== null) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.body}>
        <Text style={styles.successTitle}>Request received</Text>
        <Text style={styles.text}>
          Thank you! Your enquiry reference is{' '}
          <Text style={styles.bold}>{ref}</Text>.
        </Text>
        <Text style={styles.text}>
          Our team will call you. Please keep this reference handy.
        </Text>
        <Pressable
          style={[styles.button, styles.whatsappButton]}
          onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => Linking.openURL(whatsappUrl(whatsappMessage))}>
          <Text style={styles.buttonText}>WhatsApp us about this enquiry</Text>
        </Pressable>
        <Text style={styles.note}>
          Message us with your reference {ref} — the team can look it up.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.body}>
      <Text style={styles.packageLabel}>Enquiring about</Text>
      <Text style={styles.packageName}>{packageName}</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Phone *</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Mobile number"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Travel date (optional)</Text>
      <TextInput
        style={styles.input}
        value={travelDate}
        onChangeText={setTravelDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Travellers (optional)</Text>
      <TextInput
        style={styles.input}
        value={travellers}
        onChangeText={setTravellers}
        placeholder="e.g. 2"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Message (optional)</Text>
      <TextInput
        style={[styles.input, styles.messageInput]}
        value={message}
        onChangeText={setMessage}
        placeholder="Anything we should know?"
        multiline
      />

      {error !== null ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {queued ? (
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigation.navigate('OfflineDiagnostics')}>
              <Text style={styles.buttonText}>View outbox</Text>
            </Pressable>
          ) : null}
          <Text style={styles.errorText}>
            Your enquiry has not been lost — you can send the same details
            on WhatsApp instead:
          </Text>
          <Pressable
            style={[styles.button, styles.whatsappButton]}
            onPress={() => Linking.openURL(whatsappUrl(whatsappMessage))}>
            <Text style={styles.buttonText}>WhatsApp the team instead</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, styles.primaryButton, submitting ? styles.disabled : null]}
        onPress={handleSubmit}
        disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Request callback</Text>
        )}
      </Pressable>
      <Text style={styles.note}>
        We will call you with a free quote. No payment is taken here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  body: { padding: 16, paddingBottom: 32 },
  packageLabel: { fontSize: 13, color: BRAND.muted },
  packageName: { fontSize: 18, fontWeight: '700', color: BRAND.text, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: BRAND.text,
    marginTop: 6,
  },
  messageInput: { minHeight: 90, textAlignVertical: 'top' },
  // paddingVertical 15 keeps every button >= 48dp tall (15 + 15 + ~19
  // text height); the previous 13 gave ~45dp, below the 48dp minimum.
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButton: { backgroundColor: BRAND.primary },
  whatsappButton: { backgroundColor: '#25D366' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },
  errorText: { fontSize: 14, color: '#7A1F1F', marginBottom: 6, lineHeight: 20 },
  successTitle: { fontSize: 22, fontWeight: '700', color: BRAND.text },
  text: { fontSize: 16, color: BRAND.text, marginTop: 10, lineHeight: 22 },
  bold: { fontWeight: '700' },
  note: { fontSize: 13, color: BRAND.muted, marginTop: 12, lineHeight: 18 },
});
