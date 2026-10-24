/**
 * Trip detail (v2, Category S items 181–190, plus 84/87 support).
 *
 * One screen for two real record kinds, never a third invented kind:
 * - a saved enquiry (kind 'saved', from src/lib/trips.ts), or
 * - a user-created plan (kind 'planner', from src/lib/planner.ts).
 *
 * HONESTY RULES:
 * - 182 vouchers: no booking record exists in-app today, so no voucher,
 *   booking ID or QR is ever rendered. The screen honestly says none
 *   exists yet and that a voucher appears only from a real booking.
 * - 184 day-of: only the trip record + the real team contact
 *   (src/lib/contact.ts). No driver/hotel contacts are invented.
 * - 185 balance due: shown ONLY from a real payment record. None is
 *   stored in-app, so the package price is shown labelled
 *   "to be confirmed" and only user-entered expenses are totalled.
 * - 187 share: a text summary, explicitly NOT live tracking.
 * - 188 feedback: shown only after the travel date passes, and it
 *   opens the existing Enquiry (leads) form — feedback is never
 *   displayed as a verified review, and nothing is submitted from
 *   this screen itself.
 * - 183 permits: "confirm with team" unless a real published source
 *   exists in the repo (none was found).
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCatalog } from '../lib/catalog';
import type { CatalogPackage } from '../lib/catalog';
import { getSearchPrice } from '../lib/search';
import { getPriceInfo, formatINR } from '../lib/price';
import {
  CONTACT_PHONE_DISPLAY,
  callAction,
  whatsappAction,
} from '../lib/contact';
import {
  GENERIC_CHECKLIST,
  GENERIC_DOCUMENTS,
  TRIP_TYPE_LABELS,
  buildTripStatusShareText,
  daysUntilTrip,
  formatTripDate,
  getPlannerTrip,
  getTripMeta,
  listTripExpenses,
  addTripExpense,
  deleteTripExpense,
  savePlannerTrip,
  setTripDocNote,
  setTripType,
  totalExpenses,
  tripTimeStatus,
} from '../lib/planner';
import type { PlannedTrip, TripExpense, TripType } from '../lib/planner';
import { getPackageNote, setPackageNote } from '../lib/notes';
import {
  getWishlistSnapshotDisplay,
  listPriceHistory,
  priceTrendText,
  recordPriceSnapshot,
} from '../lib/priceHistory';
import type { PriceTrend } from '../lib/priceHistory';
import { recordViewed } from '../lib/recentHistory';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

/** Cast navigation: 'TripDetail'/'Planner'/'Enquiry' wiring is the
 * coordinator's (see qa/v2-routes-planner.md); this batch owns screens,
 * not navigation types. */
type CastNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

interface TripDetailParams {
  kind: 'saved' | 'planner';
  ref?: string;
  plannerId?: string;
  slug: string;
  packageName: string;
  travelDate?: string;
}

function priceLine(pkg: CatalogPackage | undefined): string {
  if (pkg === undefined) return 'Package price: to be confirmed';
  const price = getSearchPrice(pkg);
  if (!price.hasPrice) return 'Price on enquiry — to be confirmed';
  const estimated =
    pkg.priceInfo === undefined && getPriceInfo(pkg).estimated;
  return estimated ? `${price.display} (estimated, as listed)` : price.display;
}

export function TripDetailScreen() {
  const navigation = useNavigation() as unknown as CastNav;
  const route = useRoute() as unknown as { params: TripDetailParams };
  const params = route.params;
  const catalog = useCatalog();
  const { colors, fs } = useSettings();

  const tripKey = params.ref ?? params.plannerId ?? params.slug;
  const [plannerTrip, setPlannerTrip] = useState<PlannedTrip | null>(null);
  const [tripType, setTripTypeState] = useState<TripType | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [docNote, setDocNote] = useState('');
  const [docSaved, setDocSaved] = useState(false);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [expenseLabel, setExpenseLabel] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [trend, setTrend] = useState<PriceTrend | null>(null);

  const pkg =
    params.slug !== ''
      ? catalog.packages.find((p) => p.slug === params.slug)
      : undefined;

  useEffect(() => {
    if (params.kind === 'planner' && params.plannerId !== undefined) {
      void getPlannerTrip(params.plannerId).then((t) => {
        if (t !== undefined) {
          setPlannerTrip(t);
          setTripTypeState(t.type);
        }
      });
    }
    void getTripMeta(tripKey).then((meta) => {
      if (meta.type !== undefined) setTripTypeState(meta.type);
      if (meta.docNote !== undefined) setDocNote(meta.docNote);
    });
    void listTripExpenses(tripKey).then(setExpenses);
    if (params.slug !== '') {
      void getPackageNote(params.slug).then(setNoteText);
      void recordViewed(params.slug);
      const price =
        pkg !== undefined ? getSearchPrice(pkg) : { hasPrice: false, display: '' };
      if (price.hasPrice) {
        void recordPriceSnapshot(params.slug, price.display).then(
          async (history) => {
            const wishlist = await getWishlistSnapshotDisplay(params.slug);
            setTrend(priceTrendText(history, price.display, wishlist));
          },
        );
      } else {
        void listPriceHistory(params.slug).then(async (history) => {
          const wishlist = await getWishlistSnapshotDisplay(params.slug);
          setTrend(priceTrendText(history, '', wishlist));
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, params.plannerId, params.slug, catalog.packages.length]);

  const travelDate =
    plannerTrip?.travelDate ?? params.travelDate ?? '';
  const status = tripTimeStatus(travelDate === '' ? undefined : travelDate);
  const days = travelDate !== '' ? daysUntilTrip(travelDate) : null;
  const travelers = plannerTrip?.travelers ?? [];
  const pickup = plannerTrip?.pickupPoint ?? '';

  const handleType = (t: TripType) => {
    setTripTypeState(t);
    if (plannerTrip !== null) {
      const next = { ...plannerTrip, type: t };
      setPlannerTrip(next);
      void savePlannerTrip(next);
    } else if (params.ref !== undefined) {
      void setTripType(params.ref, t);
    }
  };

  const toggleChecklist = (id: string) => {
    if (plannerTrip === null) return;
    const checked = plannerTrip.checkedChecklist.includes(id);
    const next = {
      ...plannerTrip,
      checkedChecklist: checked
        ? plannerTrip.checkedChecklist.filter((c) => c !== id)
        : [...plannerTrip.checkedChecklist, id],
    };
    setPlannerTrip(next);
    void savePlannerTrip(next);
  };

  const isPast = status === 'past';
  const isToday = status === 'today';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {params.packageName}
        </Text>
        {params.ref !== undefined ? (
          <Text style={[styles.meta, { color: colors.muted }]}>
            Enquiry ref: {params.ref}
          </Text>
        ) : null}
        {plannerTrip !== null ? (
          <Text style={[styles.meta, { color: colors.muted }]}>
            Trip plan: {plannerTrip.name}
          </Text>
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Trip type
        </Text>
        <View style={styles.chipRow}>
          {(['family', 'school', 'corporate'] as TripType[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.chip,
                {
                  borderColor: colors.primary,
                  backgroundColor:
                    tripType === t ? colors.primary : colors.background,
                },
              ]}
              onPress={() => handleType(t)}>
              <Text
                style={[
                  styles.chipText,
                  { color: tripType === t ? colors.white : colors.primary },
                ]}>
                {TRIP_TYPE_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>
        {tripType === null ? (
          <Text style={[styles.meta, { color: colors.muted }]}>
            No trip type set yet — pick one above.
          </Text>
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Upcoming trips timeline
        </Text>
        {travelDate === '' ? (
          <Text style={[styles.bodyText, { color: colors.muted }]}>
            No travel date is stored for this trip. The timeline, countdown
            and day-of screen appear once a date is set (in the plan, or
            from a booking request).
          </Text>
        ) : (
          <Text style={[styles.bodyText, { color: colors.text }]}>
            Travel date: {formatTripDate(travelDate)}
            {days !== null && days > 0 ? `\n${days} days to go.` : ''}
            {isToday ? '\nToday is the travel date — see the day-of-trip section below.' : ''}
            {isPast ? `\nThis trip date has passed — see the past-trips section below.` : ''}
          </Text>
        )}
        <Text style={[styles.bodyText, { color: colors.muted }]}>
          Travelers:{' '}
          {travelers.length > 0
            ? travelers.join(', ')
            : 'not stored for this trip — confirm with the team.'}
          {'\n'}Pickup point:{' '}
          {pickup !== '' ? pickup : 'to be confirmed with the team.'}
          {'\n'}Documents needed: see the documents folder below (generic
          list only).
        </Text>

        {isToday ? (
          <>
            <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Day-of-trip
            </Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              Today&apos;s plan: {params.packageName}
              {'\n'}Pickup point:{' '}
              {pickup !== '' ? pickup : 'to be confirmed with the team — call before leaving.'}
            </Text>
            <Text style={[styles.bodyText, { color: colors.muted }]}>
              No driver or hotel contact is stored in this app. Only the
              real team contact below is shown — the team confirms
              driver/hotel details.
            </Text>
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Team contact
        </Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          My Quick Trippers team: {CONTACT_PHONE_DISPLAY}
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={callAction}>
            <Text style={styles.buttonText}>Call the team</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.whatsapp]}
            onPress={() =>
              whatsappAction(
                `Hi My Quick Trippers! I have a question about my trip "${params.packageName}"${params.ref !== undefined ? ` (ref: ${params.ref})` : ''}.`,
              )
            }>
            <Text style={styles.buttonText}>WhatsApp the team</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Digital voucher
        </Text>
        <Text style={[styles.bodyText, { color: colors.muted }]}>
          No voucher exists for this trip yet. A voucher is shown only
          from a real booking record, and no booking exists in-app today
          — this enquiry/plan is not a confirmed booking. Ask the team
          for the voucher once your booking is confirmed.
        </Text>

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Trip documents folder
        </Text>
        {GENERIC_DOCUMENTS.map((doc) => (
          <Text key={doc} style={[styles.bodyText, { color: colors.text }]}>
            • {doc}
          </Text>
        ))}
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Your document notes (private, on this device)"
          placeholderTextColor={colors.muted}
          multiline
          value={docNote}
          onChangeText={(v) => {
            setDocNote(v);
            setDocSaved(false);
          }}
        />
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => {
            void setTripDocNote(tripKey, docNote).then(() =>
              setDocSaved(true),
            );
          }}>
          <Text style={styles.buttonText}>Save document notes</Text>
        </Pressable>
        {docSaved ? (
          <Text style={[styles.meta, { color: colors.muted }]}>Notes saved.</Text>
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Pre-trip checklist (generic items)
        </Text>
        {GENERIC_CHECKLIST.map((item) => {
          const checked =
            plannerTrip?.checkedChecklist.includes(item.id) ?? false;
          const row = (
            <Text style={[styles.bodyText, { color: colors.text }]}>
              {plannerTrip !== null ? (checked ? '✓ ' : '○ ') : '• '}
              {item.label}
            </Text>
          );
          return plannerTrip !== null ? (
            <Pressable key={item.id} onPress={() => toggleChecklist(item.id)}>
              {row}
            </Pressable>
          ) : (
            <View key={item.id}>{row}</View>
          );
        })}
        {plannerTrip === null ? (
          <Text style={[styles.meta, { color: colors.muted }]}>
            Tick-off tracking lives in a trip plan — save this trip to a
            plan in the Planner to tick items off.
          </Text>
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Expenses for this trip
        </Text>
        <Text style={[styles.bodyText, { color: colors.muted }]}>
          No payment record is stored in this app, so no balance due can
          be shown. Package price is shown as to be confirmed below;
          only expenses you enter here are totalled.
        </Text>
        <Text style={[styles.bodyText, { color: colors.text }]}>
          Package price: {priceLine(pkg)} (to be confirmed)
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Expense label, e.g. Extra night"
          placeholderTextColor={colors.muted}
          value={expenseLabel}
          onChangeText={setExpenseLabel}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Amount in ₹ (your entry)"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={expenseAmount}
          onChangeText={setExpenseAmount}
        />
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (expenseLabel.trim() === '') return;
            const amount = parseInt(
              expenseAmount.replace(/[^0-9]/g, ''),
              10,
            );
            void addTripExpense(
              tripKey,
              expenseLabel,
              Number.isNaN(amount) ? 0 : amount,
            ).then((list) => {
              setExpenses(list);
              setExpenseLabel('');
              setExpenseAmount('');
            });
          }}>
          <Text style={styles.buttonText}>Add expense</Text>
        </Pressable>
        {expenses.map((expense) => (
          <View key={expense.id} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.rowText, { color: colors.text }]}>
              {expense.label} — {formatINR(expense.amount)}
            </Text>
            <Pressable
              style={[styles.smallButton, { borderColor: colors.primary }]}
              onPress={() => {
                void deleteTripExpense(tripKey, expense.id).then(() =>
                  setExpenses((prev) =>
                    prev.filter((e) => e.id !== expense.id),
                  ),
                );
              }}>
              <Text style={[styles.smallText, { color: colors.primary }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        ))}
        <Text style={[styles.bodyText, { color: colors.text }]}>
          Total of your entered expenses: {formatINR(totalExpenses(expenses))}
        </Text>

        {pkg !== undefined ? (
          <>
            <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Price history
            </Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              Current listed price: {priceLine(pkg)}
              {trend !== null ? `\n${trend.text}` : ''}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]}>
              Observed prices only — no prediction and no buy/wait advice.
            </Text>

            <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              My note on this package
            </Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Ask Amit about the hotel"
              placeholderTextColor={colors.muted}
              multiline
              value={noteText}
              onChangeText={(v) => {
                setNoteText(v);
                setNoteSaved(false);
              }}
            />
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => {
                void setPackageNote(params.slug, noteText).then(() =>
                  setNoteSaved(true),
                );
              }}>
              <Text style={styles.buttonText}>Save note</Text>
            </Pressable>
            {noteSaved ? (
              <Text style={[styles.meta, { color: colors.muted }]}>Note saved.</Text>
            ) : null}
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Share trip status with family
        </Text>
        <Text style={[styles.bodyText, { color: colors.muted }]}>
          This sends a text summary — it is NOT live tracking. No live
          location is shared.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => {
            void Share.share({
              message: buildTripStatusShareText(
                params.packageName,
                travelDate === '' ? undefined : travelDate,
                params.ref,
                CONTACT_PHONE_DISPLAY,
              ),
            });
          }}>
          <Text style={styles.buttonText}>Share trip status (text)</Text>
        </Pressable>

        {isPast ? (
          <>
            <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Past trip
            </Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              This trip&apos;s date has passed. It stays in your past-trips
              archive on the Trips tab.
            </Text>
            <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              Post-trip feedback
            </Text>
            <Text style={[styles.bodyText, { color: colors.muted }]}>
              How was the trip? Your feedback goes through the existing
              enquiry (leads) channel — write it in the enquiry form. It
              is not displayed as a verified review.
            </Text>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (params.slug === '') return;
                navigation.navigate('Enquiry', {
                  slug: params.slug,
                  packageName: params.packageName,
                  contactPref: `Post-trip feedback for trip${params.ref !== undefined ? ` ref ${params.ref}` : ''}`,
                });
              }}>
              <Text style={styles.buttonText}>Give feedback (enquiry form)</Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (params.slug === '') return;
                navigation.navigate('Enquiry', {
                  slug: params.slug,
                  packageName: params.packageName,
                  travelerCount:
                    travelers.length > 0 ? travelers.length : undefined,
                  travelerNames:
                    travelers.length > 0
                      ? travelers.join(', ')
                      : undefined,
                });
              }}>
              <Text style={styles.buttonText}>Book again</Text>
            </Pressable>
          </>
        ) : null}

        {plannerTrip === null && params.slug !== '' ? (
          <Pressable
            style={[styles.button, styles.outlineButton, { borderColor: colors.primary }]}
            onPress={() => navigation.navigate('Planner', {})}>
            <Text style={[styles.buttonText, { color: colors.primary }]}>
              Open trip planner
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  meta: { fontSize: FONT.meta, marginTop: SPACING.xs, lineHeight: 18 },
  section: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  bodyText: { fontSize: FONT.body, marginTop: SPACING.sm, lineHeight: 22 },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  chip: {
    borderWidth: 1,
    borderRadius: RADII.pill,
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  chipText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  outlineButton: { borderWidth: 1, backgroundColor: 'transparent' },
  whatsapp: { backgroundColor: '#25D366' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    fontSize: FONT.body,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADII.card,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    minHeight: TOUCH_MIN,
  },
  rowText: { fontSize: FONT.body, flex: 1, lineHeight: 20 },
  smallButton: {
    borderWidth: 1,
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  smallText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
});
