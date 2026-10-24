import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import {
  ApiError,
  isValidEmail,
  isValidEnquiryPhone,
  submitEnquiry,
  travelDateError,
} from '../lib/api';
import { whatsappAction } from '../lib/contact';
import { listTravelers, loadProfile } from '../lib/settings';
import type { Traveler } from '../lib/settings';
import { saveTrip } from '../lib/trips';
import { useCatalog } from '../lib/catalog';
import { getPriceInfo } from '../lib/price';
import type { RootStackParamList } from '../navigation/types';
import {
  ADDON_OPTIONS,
  buildBookingMessage,
  clearBookingDraft,
  emptyDraft,
  loadBookingDraft,
  saveBookingDraft,
  travelerTotal,
} from '../lib/booking';
import type { BookingDraft, BookingTraveler } from '../lib/booking';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;

const STEP_LABELS = [
  'Dates',
  'Travelers',
  'Rooms',
  'Add-ons',
  'Contact',
  'Review',
];

/**
 * Booking REQUEST flow (v1.3, items 41–50). The business has no booking
 * engine: this collects a request and sends it through the existing
 * submitEnquiry() lead channel. It is labeled "booking request" on
 * every step, never a confirmed booking. No availability, seasonal
 * price, coupon, or confirmation number is invented; the review step
 * shows the listed price as-is and explicitly does NOT compute a
 * total (per-person vs total is unknown).
 */
export function BookingScreen({ route, navigation }: Props) {
  const { slug, packageName } = route.params;
  const catalog = useCatalog();
  const pkg = catalog.packages.find((p) => p.slug === slug);
  const price = pkg !== undefined ? getPriceInfo(pkg) : null;
  const listedPrice = price !== null && price.hasPrice ? price.display : '';

  const formRenderedAtRef = useRef(0);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saved, setSaved] = useState<Traveler[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState<string | null>(null);

  // Manual traveler form (step 2).
  const [manualName, setManualName] = useState('');
  const [manualAge, setManualAge] = useState('');
  const [manualBand, setManualBand] = useState<'adult' | 'child'>('adult');

  useEffect(() => {
    formRenderedAtRef.current = Date.now();
    let alive = true;
    void (async () => {
      const [restored, travelers, profile] = await Promise.all([
        loadBookingDraft(slug),
        listTravelers(),
        loadProfile(),
      ]);
      if (!alive) return;
      setSaved(travelers);
      if (restored !== null) {
        setDraft(restored);
        setDraftRestored(true);
      } else {
        const fresh = emptyDraft(slug, packageName);
        fresh.contactName = profile.name;
        fresh.contactPhone = profile.phone;
        fresh.contactEmail = profile.email;
        setDraft(fresh);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, packageName]);

  // Persist the draft on every change (item 41: resumable progress).
  useEffect(() => {
    if (draft !== null) void saveBookingDraft(draft);
  }, [draft]);

  function update(patch: Partial<BookingDraft>): void {
    setDraft((prev) => (prev === null ? prev : { ...prev, ...patch }));
    setError(null);
  }

  function stepError(d: BookingDraft, step: number): string | null {
    if (step === 0) {
      const e1 = travelDateError(d.preferredDate);
      if (e1) return e1;
      const e2 = travelDateError(d.alternateDate);
      if (e2) return e2;
      if (
        d.preferredDate === '' &&
        d.alternateDate === '' &&
        d.flexibleMonth.trim() === ''
      ) {
        return 'Please pick a preferred date or a flexible month.';
      }
      return null;
    }
    if (step === 1) {
      if (d.travelers.length === 0) {
        return 'Please add at least one traveler (pick a saved traveler or add one manually).';
      }
      if (d.travelers.some((t) => t.name.trim() === '')) {
        return 'Every traveler needs a name.';
      }
      if (
        d.travelers.some(
          (t) => t.age !== '' && (!/^\d+$/.test(t.age) || Number(t.age) > 120),
        )
      ) {
        return 'Ages, when entered, must be numbers up to 120.';
      }
      return null;
    }
    if (step === 2) {
      if (travelerTotal(d) < 1) return 'At least one traveler is needed.';
      return null;
    }
    if (step === 3) {
      if (d.groupMode) {
        const size = Number(d.groupSize);
        if (
          d.groupSize.trim() !== '' &&
          (!Number.isInteger(size) || size < 10)
        ) {
          return 'Group bookings are for 10+ travelers.';
        }
      }
      return null;
    }
    if (step === 4) {
      if (d.contactName.trim().length < 2) {
        return 'Please enter your name (at least 2 characters).';
      }
      if (!isValidEnquiryPhone(d.contactPhone)) {
        return 'Please enter a valid phone number (8–15 digits).';
      }
      if (d.contactEmail.trim() !== '' && !isValidEmail(d.contactEmail)) {
        return 'Please enter a valid email address, or leave it blank.';
      }
      return null;
    }
    return null;
  }

  function next(): void {
    if (draft === null) return;
    const err = stepError(draft, draft.step);
    if (err) {
      setError(err);
      return;
    }
    update({ step: Math.min(draft.step + 1, 5) });
  }

  function back(): void {
    if (draft === null) return;
    update({ step: Math.max(draft.step - 1, 0) });
  }

  async function startOver(): Promise<void> {
    await clearBookingDraft();
    setDraft(emptyDraft(slug, packageName));
    setDraftRestored(false);
    setError(null);
  }

  function toggleSaved(t: Traveler): void {
    if (draft === null) return;
    const exists = draft.travelers.some(
      (x) => x.fromSaved === true && x.name === t.name && x.band === t.band,
    );
    if (exists) {
      update({
        travelers: draft.travelers.filter(
          (x) => !(x.fromSaved === true && x.name === t.name && x.band === t.band),
        ),
      });
    } else {
      const traveler: BookingTraveler = {
        name: t.name,
        age: '',
        band: t.band,
        fromSaved: true,
      };
      update({ travelers: [...draft.travelers, traveler] });
    }
  }

  function addManual(): void {
    if (draft === null) return;
    if (manualName.trim() === '') {
      setError('Please enter the traveler name.');
      return;
    }
    if (
      manualAge !== '' &&
      (!/^\d+$/.test(manualAge) || Number(manualAge) > 120)
    ) {
      setError('Age, when entered, must be a number up to 120.');
      return;
    }
    update({
      travelers: [
        ...draft.travelers,
        { name: manualName.trim(), age: manualAge, band: manualBand },
      ],
    });
    setManualName('');
    setManualAge('');
  }

  async function handleSubmit(): Promise<void> {
    if (draft === null) return;
    setError(null);
    for (let s = 0; s <= 4; s++) {
      const err = stepError(draft, s);
      if (err) {
        setError(err);
        update({ step: s });
        return;
      }
    }
    const total = Math.max(travelerTotal(draft), draft.travelers.length);
    const message = buildBookingMessage(draft, listedPrice);
    setSubmitting(true);
    try {
      const result = await submitEnquiry(
        {
          name: draft.contactName,
          phone: draft.contactPhone,
          email: draft.contactEmail === '' ? undefined : draft.contactEmail,
          packageSlug: slug,
          packageName,
          travelDate:
            draft.preferredDate === '' ? undefined : draft.preferredDate,
          travellers: total,
          message,
        },
        formRenderedAtRef.current,
      );
      if (result.ref) {
        setRef(result.ref);
        await clearBookingDraft();
        try {
          await saveTrip({
            slug,
            packageName,
            ref: result.ref,
            date: new Date().toISOString(),
            travelDate:
              draft.preferredDate === '' ? undefined : draft.preferredDate,
          });
        } catch {
          // Best-effort only — the request itself already succeeded.
        }
      } else {
        setError(
          'Your request could not be confirmed. Please try again or contact us on WhatsApp.',
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          'Something went wrong. Please try again or contact us on WhatsApp.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (draft === null) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Item 49: request-received state — real enquiry ref only, no voucher,
  // no confirmation number beyond the ref.
  if (ref !== null) {
    const whatsappMessage =
      `Hi My Quick Trippers! I just sent a booking request for "${packageName}" (enquiry ref: ${ref}). ` +
      'Please call me back to confirm dates and the final quote.';
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.successTitle}>Booking request received</Text>
          <Text style={styles.text}>
            Thank you! Your booking request has been sent to the team. This
            is a request, not a confirmed booking — the team will call you
            to confirm dates, availability and the final quote.
          </Text>
          <Text style={styles.text}>Enquiry ref: {ref}</Text>
          {draft.preferredDate !== '' ? (
            <Text style={styles.text}>
              Preferred travel date: {draft.preferredDate}
            </Text>
          ) : null}
          <Text style={styles.note}>
            No voucher is issued here: there is no confirmed booking to
            voucher yet. Your saved trip appears under My Trips.
          </Text>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => whatsappAction(whatsappMessage)}>
            <Text style={styles.primaryButtonText}>
              Follow up on WhatsApp
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })}>
            <Text style={styles.secondaryButtonText}>View my trips</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('PackageDetail', { slug })}>
            <Text style={styles.secondaryButtonText}>Back to package</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const step = draft.step;
  const total = travelerTotal(draft);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Booking request</Text>
        <Text style={styles.subtitle}>
          This sends a booking request to the team — it is not a confirmed
          booking, and no payment is taken here.
        </Text>
        {draftRestored ? (
          <View style={styles.draftNote}>
            <Text style={styles.draftNoteText}>
              Your saved draft was restored — you can pick up where you
              left off.
            </Text>
            <Pressable onPress={() => void startOver()}>
              <Text style={styles.linkText}>Start over</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.progress}>
          Step {step + 1} of 6: {STEP_LABELS[step]}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${((step + 1) / 6) * 100}%` }]}
          />
        </View>

        {step === 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Preferred dates</Text>
            <Text style={styles.note}>
              Preferred dates — confirmed departures are shared by the team.
              No blackout dates or seasonal prices are shown because none
              are published for this package.
            </Text>
            <Text style={styles.label}>Preferred travel date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={draft.preferredDate}
              onChangeText={(v) => update({ preferredDate: v })}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Alternate date (optional)</Text>
            <TextInput
              style={styles.input}
              value={draft.alternateDate}
              onChangeText={(v) => update({ alternateDate: v })}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Flexible month (optional)</Text>
            <TextInput
              style={styles.input}
              value={draft.flexibleMonth}
              onChangeText={(v) => update({ flexibleMonth: v })}
              placeholder="e.g. December 2026"
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={styles.sectionHeading}>Travelers</Text>
            <Text style={styles.note}>
              Names are required; ages are optional numbers you enter here
              (saved profiles do not store ages).
            </Text>
            {saved.length > 0 ? (
              <View>
                <Text style={styles.label}>Saved travelers — tap to add</Text>
                {saved.map((t) => {
                  const selected = draft.travelers.some(
                    (x) =>
                      x.fromSaved === true &&
                      x.name === t.name &&
                      x.band === t.band,
                  );
                  return (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.checkRow,
                        selected ? styles.checkRowSelected : null,
                      ]}
                      onPress={() => toggleSaved(t)}>
                      <Text style={styles.checkText}>
                        {selected ? '✓ ' : ''}
                        {t.name} ({t.band}
                        {t.relation !== '' ? `, ${t.relation}` : ''})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Text style={styles.label}>Add a traveler manually</Text>
            <TextInput
              style={styles.input}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Full name (required)"
            />
            <TextInput
              style={styles.input}
              value={manualAge}
              onChangeText={setManualAge}
              placeholder="Age (optional)"
              keyboardType="number-pad"
            />
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.chip,
                  manualBand === 'adult' ? styles.chipSelected : null,
                ]}
                onPress={() => setManualBand('adult')}>
                <Text style={styles.chipText}>Adult</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  manualBand === 'child' ? styles.chipSelected : null,
                ]}
                onPress={() => setManualBand('child')}>
                <Text style={styles.chipText}>Child</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.smallPrimary]} onPress={addManual}>
                <Text style={styles.primaryButtonText}>Add traveler</Text>
              </Pressable>
            </View>
            {draft.travelers.length > 0 ? (
              <View>
                <Text style={styles.label}>Travelers on this request</Text>
                {draft.travelers.map((t, i) => (
                  <View key={`${t.name}-${i}`} style={styles.travelerRow}>
                    <Text style={styles.text}>
                      {t.name} ({t.band}
                      {t.age !== '' ? `, age ${t.age}` : ''})
                    </Text>
                    <Pressable
                      onPress={() =>
                        update({
                          travelers: draft.travelers.filter((_, j) => j !== i),
                        })
                      }>
                      <Text style={styles.linkText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text style={styles.sectionHeading}>Rooms</Text>
            <Text style={styles.note}>
              Counts are a request — room allocation is confirmed by the
              team on callback.
            </Text>
            {(
              [
                ['adults', 'Adults', draft.adults],
                ['children', 'Children', draft.children],
                ['infants', 'Infants', draft.infants],
              ] as const
            ).map(([key, label, value]) => (
              <View key={key} style={styles.counterRow}>
                <Text style={styles.text}>{label}</Text>
                <View style={styles.row}>
                  <Pressable
                    style={styles.counterButton}
                    onPress={() =>
                      update({ [key]: Math.max(0, value - 1) } as Partial<BookingDraft>)
                    }>
                    <Text style={styles.counterButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.counterValue}>{value}</Text>
                  <Pressable
                    style={styles.counterButton}
                    onPress={() =>
                      update({ [key]: value + 1 } as Partial<BookingDraft>)
                    }>
                    <Text style={styles.counterButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.label}>Sharing</Text>
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.chip,
                  draft.sharing === 'double' ? styles.chipSelected : null,
                ]}
                onPress={() => update({ sharing: 'double' })}>
                <Text style={styles.chipText}>Double sharing</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  draft.sharing === 'triple' ? styles.chipSelected : null,
                ]}
                onPress={() => update({ sharing: 'triple' })}>
                <Text style={styles.chipText}>Triple sharing</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.checkRow}
              onPress={() => update({ extraMattress: !draft.extraMattress })}>
              <Text style={styles.checkText}>
                {draft.extraMattress ? '✓ ' : ''}Extra mattress (request)
              </Text>
            </Pressable>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text style={styles.sectionHeading}>Add-ons</Text>
            <Text style={styles.note}>
              These are requests — confirmed by the team. No prices are
              shown because none are published for these add-ons.
            </Text>
            {ADDON_OPTIONS.map((opt) => {
              const selected = draft.addons.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.checkRow,
                    selected ? styles.checkRowSelected : null,
                  ]}
                  onPress={() =>
                    update({
                      addons: selected
                        ? draft.addons.filter((a) => a !== opt.id)
                        : [...draft.addons, opt.id],
                    })
                  }>
                  <Text style={styles.checkText}>
                    {selected ? '✓ ' : ''}
                    {opt.label} (request)
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={styles.checkRow}
              onPress={() => update({ priceHold: !draft.priceHold })}>
              <Text style={styles.checkText}>
                {draft.priceHold ? '✓ ' : ''}
                Ask the team to hold this price for 24 hours (request, not
                a guarantee)
              </Text>
            </Pressable>
            <Pressable
              style={styles.checkRow}
              onPress={() => update({ groupMode: !draft.groupMode })}>
              <Text style={styles.checkText}>
                {draft.groupMode ? '✓ ' : ''}
                School / corporate group booking (10+ travelers)
              </Text>
            </Pressable>
            {draft.groupMode ? (
              <View>
                <Text style={styles.note}>
                  Per-head pricing is requested, not quoted. Teacher-free
                  terms are confirmed by the team on callback.
                </Text>
                <Text style={styles.label}>School / company name</Text>
                <TextInput
                  style={styles.input}
                  value={draft.groupName}
                  onChangeText={(v) => update({ groupName: v })}
                  placeholder="e.g. Delhi Public School"
                />
                <Text style={styles.label}>Group size (10+)</Text>
                <TextInput
                  style={styles.input}
                  value={draft.groupSize}
                  onChangeText={(v) => update({ groupSize: v })}
                  placeholder="e.g. 50"
                  keyboardType="number-pad"
                />
              </View>
            ) : null}
            <Text style={styles.label}>Anything else to ask the team?</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={draft.notes}
              onChangeText={(v) => update({ notes: v })}
              placeholder="Optional notes for the team"
              multiline
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View>
            <Text style={styles.sectionHeading}>Contact</Text>
            <Text style={styles.note}>
              The team calls back on this number to confirm your request.
            </Text>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={draft.contactName}
              onChangeText={(v) => update({ contactName: v })}
              placeholder="Full name"
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={draft.contactPhone}
              onChangeText={(v) => update({ contactPhone: v })}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
              style={styles.input}
              value={draft.contactEmail}
              onChangeText={(v) => update({ contactEmail: v })}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        ) : null}

        {step === 5 ? (
          <View>
            <Text style={styles.sectionHeading}>Review your request</Text>
            <Text style={styles.note}>
              Check everything before sending. This is a booking request,
              not a payment and not a confirmed booking.
            </Text>
            <Text style={styles.reviewLine}>Package: {packageName}</Text>
            <Text style={styles.reviewLine}>
              Price as listed:{' '}
              {listedPrice !== '' ? listedPrice : 'Price on enquiry'}
            </Text>
            <Text style={styles.reviewLine}>
              Dates:{' '}
              {[
                draft.preferredDate !== '' ? draft.preferredDate : null,
                draft.alternateDate !== '' ? `alt: ${draft.alternateDate}` : null,
                draft.flexibleMonth !== '' ? `flexible: ${draft.flexibleMonth}` : null,
              ]
                .filter((x) => x !== null)
                .join(', ') || '—'}
            </Text>
            <Text style={styles.reviewLine}>
              Travelers: {total} ({draft.adults} adult(s), {draft.children}{' '}
              child(ren), {draft.infants} infant(s))
            </Text>
            {draft.travelers.length > 0 ? (
              <Text style={styles.reviewLine}>
                Names:{' '}
                {draft.travelers
                  .map(
                    (t) =>
                      `${t.name} (${t.band}${t.age !== '' ? `, ${t.age}` : ''})`,
                  )
                  .join('; ')}
              </Text>
            ) : null}
            <Text style={styles.reviewLine}>
              Rooms: {draft.sharing} sharing
              {draft.extraMattress ? ', extra mattress requested' : ''}
            </Text>
            {draft.addons.length > 0 ? (
              <Text style={styles.reviewLine}>
                Add-on requests:{' '}
                {draft.addons
                  .map(
                    (a) =>
                      ADDON_OPTIONS.find((o) => o.id === a)?.label ?? a,
                  )
                  .join(', ')}
              </Text>
            ) : null}
            {draft.groupMode ? (
              <Text style={styles.reviewLine}>
                Group booking request
                {draft.groupName !== '' ? ` — ${draft.groupName}` : ''}
                {draft.groupSize !== '' ? ` (${draft.groupSize} travelers)` : ''};
                per-head pricing requested, teacher-free terms confirmed by
                the team on callback.
              </Text>
            ) : null}
            {draft.priceHold ? (
              <Text style={styles.reviewLine}>
                Price-hold requested for 24 hours (request, not a guarantee).
              </Text>
            ) : null}
            <Text style={styles.reviewLine}>
              Contact: {draft.contactName}, {draft.contactPhone}
              {draft.contactEmail !== '' ? `, ${draft.contactEmail}` : ''}
            </Text>
            <Text style={[styles.reviewLine, styles.important]}>
              Final total: confirmed by the team on callback. No total is
              calculated here because whether the listed price is per
              person or for the whole trip is not stated in the price data.
            </Text>
            <Text style={styles.reviewLine}>
              Discounts and offers are confirmed by the team on callback —
              there is no coupon code field because no coupon system
              exists.
            </Text>
            <Text style={styles.note}>
              Tap Back to edit any section, or Send booking request below.
            </Text>
          </View>
        ) : null}

        {error !== null ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.navRow}>
          {step > 0 ? (
            <Pressable
              style={[styles.button, styles.secondaryButton, styles.navButton]}
              onPress={back}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          ) : null}
          {step < 5 ? (
            <Pressable
              style={[styles.button, styles.primaryButton, styles.navButton]}
              onPress={next}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, styles.primaryButton, styles.navButton]}
              onPress={() => void handleSubmit()}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Send booking request
                </Text>
              )}
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('Enquiry', { slug, packageName })}>
          <Text style={styles.secondaryButtonText}>
            Or send a simple enquiry instead
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: {
    fontSize: FONT.title,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT.body,
    color: COLORS.muted,
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  successTitle: {
    fontSize: FONT.title,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
  },
  text: { fontSize: FONT.body, color: COLORS.text, lineHeight: 22 },
  note: {
    fontSize: FONT.meta,
    color: COLORS.muted,
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
  draftNote: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.card,
  },
  draftNoteText: { fontSize: FONT.body, color: COLORS.text, lineHeight: 20 },
  linkText: {
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  progress: {
    fontSize: FONT.meta,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: COLORS.primary },
  sectionHeading: {
    fontSize: FONT.heading,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  label: {
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT.body,
    color: COLORS.text,
    marginTop: SPACING.sm,
    minHeight: TOUCH_MIN,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: COLORS.estimatedBg },
  chipText: { fontSize: FONT.body, fontWeight: WEIGHT.bold, color: COLORS.primary },
  checkRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.button,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
  },
  checkRowSelected: { borderColor: COLORS.primary },
  checkText: { fontSize: FONT.body, color: COLORS.text },
  travelerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: { fontSize: 20, color: COLORS.primary, fontWeight: WEIGHT.bold },
  counterValue: { fontSize: FONT.body, fontWeight: WEIGHT.bold, color: COLORS.text, minWidth: 32, textAlign: 'center' },
  reviewLine: {
    fontSize: FONT.body,
    color: COLORS.text,
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
  important: { fontWeight: WEIGHT.bold },
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderRadius: RADII.button,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  errorText: { fontSize: FONT.body, color: COLORS.errorText, lineHeight: 20 },
  navRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  navButton: { flex: 1 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  smallPrimary: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg },
  primaryButton: { backgroundColor: COLORS.primary },
  primaryButtonText: { color: COLORS.white, fontSize: FONT.body, fontWeight: WEIGHT.bold },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.primary },
  secondaryButtonText: { color: COLORS.primary, fontSize: FONT.body, fontWeight: WEIGHT.bold },
});
