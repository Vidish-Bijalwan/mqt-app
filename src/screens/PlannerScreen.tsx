/**
 * Trip planner (v2, Category I items 81/82/85/86/87/88/89/190).
 *
 * Reachable from the Trips tab (see qa/v2-routes-planner.md for the
 * coordinator's route wiring — this screen is written against the
 * not-yet-registered 'Planner' route, so navigation is cast with a
 * comment rather than editing navigation/types.ts, which this batch
 * must not touch).
 *
 * Everything here is device-local. Package data and prices come only
 * from the real catalogue; flights/extras are user-entered only.
 * Festival/season calendar (item 90) is deliberately NOT rendered:
 * no verified structured festival dates exist in the repo, so the
 * screen says so instead of listing guessed dates.
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCatalog } from '../lib/catalog';
import type { CatalogPackage } from '../lib/catalog';
import { getSearchPrice, searchPackages } from '../lib/search';
import { getPriceInfo, formatINR } from '../lib/price';
import {
  GENERIC_CHECKLIST,
  TRIP_TYPE_LABELS,
  computeBudget,
  daysUntilTrip,
  emptyPlannedTrip,
  listPlannerTrips,
  parseUserAmount,
  savePlannerTrip,
  deletePlannerTrip,
  buildPlannerShareText,
} from '../lib/planner';
import type { PlannedTrip, TripType } from '../lib/planner';
import { getPackageNote, setPackageNote } from '../lib/notes';
import {
  clearViewed,
  listCompared,
  listViewed,
  recordViewed,
} from '../lib/recentHistory';
import type { ViewedEntry } from '../lib/recentHistory';
import { recordPriceSnapshot } from '../lib/priceHistory';
import { matchQuizPackages } from '../lib/quiz';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

/** Cast navigation: 'Planner'/'TripDetail' routes are registered by the
 * coordinator (see qa/v2-routes-planner.md); this batch owns screens,
 * not navigation types. */
type CastNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

function priceLine(pkg: CatalogPackage): string {
  const price = getSearchPrice(pkg);
  if (!price.hasPrice) return 'Price on enquiry';
  const estimated =
    pkg.priceInfo === undefined && getPriceInfo(pkg).estimated;
  return estimated ? `${price.display} (estimated, as listed)` : price.display;
}

function titleOf(packages: CatalogPackage[], slug: string): string {
  return packages.find((p) => p.slug === slug)?.title ?? slug;
}

export function PlannerScreen() {
  const navigation = useNavigation() as unknown as CastNav;
  const route = useRoute() as unknown as {
    params?: { focusTripId?: string };
  };
  const catalog = useCatalog();
  const { colors, fs } = useSettings();

  const [trips, setTrips] = useState<PlannedTrip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<TripType>('family');
  const [travelDate, setTravelDate] = useState('');
  const [travelersText, setTravelersText] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [budgetTravelers, setBudgetTravelers] = useState('2');
  const [flightCost, setFlightCost] = useState('');
  const [extrasCost, setExtrasCost] = useState('');
  const [quizBudget, setQuizBudget] = useState('');
  const [quizInterests, setQuizInterests] = useState('');
  const [quizDates, setQuizDates] = useState('');
  const [quizRan, setQuizRan] = useState(false);
  const [viewed, setViewed] = useState<ViewedEntry[]>([]);
  const [compared, setCompared] = useState<string[]>([]);
  const [noteSlug, setNoteSlug] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  const refresh = useCallback(() => {
    void listPlannerTrips().then((list) => {
      setTrips(list);
      if (route.params?.focusTripId !== undefined) {
        setSelectedId(route.params.focusTripId);
      } else if (selectedId === null && list.length > 0) {
        setSelectedId(list[0].id);
      }
    });
    void listViewed().then(setViewed);
    void listCompared().then(setCompared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(refresh);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected =
    trips.find((t) => t.id === selectedId) ?? trips[0] ?? null;

  const handleCreate = () => {
    if (name.trim() === '') return;
    const trip = emptyPlannedTrip(name, type);
    trip.travelDate = travelDate.trim();
    trip.travelers = travelersText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    void savePlannerTrip(trip).then(() => {
      setTrips((prev) => [trip, ...prev]);
      setSelectedId(trip.id);
      setName('');
      setTravelDate('');
      setTravelersText('');
    });
  };

  const updateSelected = (patch: Partial<PlannedTrip>) => {
    if (selected === null) return;
    const next = { ...selected, ...patch };
    setTrips((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    void savePlannerTrip(next);
  };

  const addResults =
    addQuery.trim() === ''
      ? []
      : searchPackages(catalog.packages, addQuery).slice(0, 8);

  const selectedPackages: CatalogPackage[] =
    selected === null
      ? []
      : selected.packageSlugs
          .map((slug) => catalog.packages.find((p) => p.slug === slug))
          .filter((p): p is CatalogPackage => p !== undefined);

  const budget = computeBudget({
    packageDeals: selectedPackages.map((pkg) => {
      const price = getSearchPrice(pkg);
      return { hasPrice: price.hasPrice, deal: price.deal };
    }),
    travelers: parseUserAmount(budgetTravelers) || 1,
    flightCost: parseUserAmount(flightCost),
    extrasCost: parseUserAmount(extrasCost),
  });

  const quizResults = quizRan
    ? matchQuizPackages(catalog.packages, {
        budgetMax:
          quizBudget.trim() === '' ? null : parseUserAmount(quizBudget),
        interests: quizInterests,
        preferredDates: quizDates,
      })
    : [];

  const openPackage = (pkg: CatalogPackage) => {
    const price = getSearchPrice(pkg);
    void recordViewed(pkg.slug);
    if (price.hasPrice) void recordPriceSnapshot(pkg.slug, price.display);
    navigation.navigate('PackageDetail', { slug: pkg.slug });
  };

  const openNoteEditor = (slug: string) => {
    setNoteSlug(slug);
    setNoteSaved(false);
    void getPackageNote(slug).then(setNoteText);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Trip planner
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Save packages into named trips, estimate the budget and share
          the plan with family. Everything here stays on this device.
        </Text>

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Create a trip plan
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Trip name, e.g. Goa Nov"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />
        <View style={styles.chipRow}>
          {(['family', 'school', 'corporate'] as TripType[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.chip,
                {
                  borderColor: colors.primary,
                  backgroundColor:
                    type === t ? colors.primary : colors.background,
                },
              ]}
              onPress={() => setType(t)}>
              <Text
                style={[
                  styles.chipText,
                  { color: type === t ? colors.white : colors.primary },
                ]}>
                {TRIP_TYPE_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Preferred travel date (YYYY-MM-DD, optional)"
          placeholderTextColor={colors.muted}
          value={travelDate}
          onChangeText={setTravelDate}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Travelers, comma-separated names (optional)"
          placeholderTextColor={colors.muted}
          value={travelersText}
          onChangeText={setTravelersText}
        />
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleCreate}>
          <Text style={styles.buttonText}>Create trip plan</Text>
        </Pressable>

        {trips.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            No trip plans yet. Create one above, then add packages to it.
          </Text>
        ) : (
          <>
            <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
              My plans
            </Text>
            {trips.map((trip) => {
              const days =
                trip.travelDate !== '' ? daysUntilTrip(trip.travelDate) : null;
              const isSelected = selected?.id === trip.id;
              return (
                <View
                  key={trip.id}
                  style={[styles.card, { borderColor: colors.border }]}>
                  <Pressable
                    style={styles.cardMain}
                    onPress={() => setSelectedId(trip.id)}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {trip.name}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.muted }]}>
                      {TRIP_TYPE_LABELS[trip.type]} ·{' '}
                      {trip.packageSlugs.length} package
                      {trip.packageSlugs.length === 1 ? '' : 's'}
                      {trip.travelDate !== ''
                        ? ` · ${trip.travelDate}`
                        : ' · date not set'}
                      {days !== null
                        ? days > 0
                          ? ` · ${days} days to go`
                          : days === 0
                            ? ' · today'
                            : ` · ${Math.abs(days)} days ago`
                        : ''}
                    </Text>
                  </Pressable>
                  {isSelected ? (
                    <View style={styles.cardActions}>
                      <Pressable
                        style={[styles.smallButton, { borderColor: colors.primary }]}
                        onPress={() => {
                          const lines = selectedPackages.map(
                            (pkg) => `${pkg.title} — ${priceLine(pkg)}`,
                          );
                          void Share.share({
                            message: buildPlannerShareText(trip, lines),
                          });
                        }}>
                        <Text style={[styles.smallText, { color: colors.primary }]}>
                          Share plan (text)
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallButton, { borderColor: colors.primary }]}
                        onPress={() =>
                          navigation.navigate('TripDetail', {
                            kind: 'planner',
                            plannerId: trip.id,
                            slug: trip.packageSlugs[0] ?? '',
                            packageName:
                              selectedPackages[0]?.title ?? trip.name,
                            travelDate: trip.travelDate,
                          })
                        }>
                        <Text style={[styles.smallText, { color: colors.primary }]}>
                          Open trip details
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallButton, { borderColor: colors.primary }]}
                        onPress={() => {
                          void deletePlannerTrip(trip.id).then(() => {
                            setTrips((prev) =>
                              prev.filter((t) => t.id !== trip.id),
                            );
                            setSelectedId(null);
                          });
                        }}>
                        <Text style={[styles.smallText, { color: colors.primary }]}>
                          Delete plan
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {selected !== null ? (
              <>
                <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                  Packages in “{selected.name}”
                </Text>
                {selectedPackages.length === 0 ? (
                  <Text style={[styles.empty, { color: colors.muted }]}>
                    No packages in this plan yet. Search below to add one.
                  </Text>
                ) : (
                  selectedPackages.map((pkg) => (
                    <View
                      key={pkg.slug}
                      style={[styles.card, { borderColor: colors.border }]}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {pkg.title}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.muted }]}>
                        {priceLine(pkg)}
                      </Text>
                      <View style={styles.cardActions}>
                        <Pressable
                          style={[styles.smallButton, { borderColor: colors.primary }]}
                          onPress={() => openPackage(pkg)}>
                          <Text style={[styles.smallText, { color: colors.primary }]}>
                            View package
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.smallButton, { borderColor: colors.primary }]}
                          onPress={() => openNoteEditor(pkg.slug)}>
                          <Text style={[styles.smallText, { color: colors.primary }]}>
                            My note
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.smallButton, { borderColor: colors.primary }]}
                          onPress={() =>
                            updateSelected({
                              packageSlugs: selected.packageSlugs.filter(
                                (s) => s !== pkg.slug,
                              ),
                            })
                          }>
                          <Text style={[styles.smallText, { color: colors.primary }]}>
                            Remove
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}

                {noteSlug !== null ? (
                  <View style={[styles.card, { borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      My note — {titleOf(catalog.packages, noteSlug)}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.muted }]}>
                      Private, stored only on this device.
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
                        void setPackageNote(noteSlug, noteText).then(() =>
                          setNoteSaved(true),
                        );
                      }}>
                      <Text style={styles.buttonText}>Save note</Text>
                    </Pressable>
                    {noteSaved ? (
                      <Text style={[styles.cardMeta, { color: colors.muted }]}>
                        Note saved.
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                  Add a package to this plan
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Search packages by destination or name"
                  placeholderTextColor={colors.muted}
                  value={addQuery}
                  onChangeText={setAddQuery}
                />
                {addResults.map((pkg) => (
                  <View
                    key={pkg.slug}
                    style={[styles.row, { borderColor: colors.border }]}>
                    <Text style={[styles.rowText, { color: colors.text }]}>
                      {pkg.title}
                    </Text>
                    <Pressable
                      style={[styles.smallButton, { borderColor: colors.primary }]}
                      onPress={() => {
                        if (!selected.packageSlugs.includes(pkg.slug)) {
                          updateSelected({
                            packageSlugs: [...selected.packageSlugs, pkg.slug],
                          });
                        }
                      }}>
                      <Text style={[styles.smallText, { color: colors.primary }]}>
                        Add
                      </Text>
                    </Pressable>
                  </View>
                ))}

                <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                  Budget estimator
                </Text>
                <Text style={[styles.sub, { color: colors.muted }]}>
                  Package prices are the real listed prices (estimated ones
                  stay labelled estimated). The total assumes the listed
                  package price is per traveler — confirm with the team.
                  Flight and extra costs are entered by you; nothing is
                  pre-filled.
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Travelers (number)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={budgetTravelers}
                  onChangeText={setBudgetTravelers}
                />
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Flight costs in ₹ (your entry)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={flightCost}
                  onChangeText={setFlightCost}
                />
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Other extras in ₹ (your entry)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={extrasCost}
                  onChangeText={setExtrasCost}
                />
                <Text style={[styles.result, { color: colors.text }]}>
                  Packages: {formatINR(budget.packageSubtotal)}
                  {'\n'}Flights: {formatINR(budget.flightCost)}
                  {'\n'}Extras: {formatINR(budget.extrasCost)}
                  {'\n'}Estimated total: {formatINR(budget.total)}
                  {'\n'}Per traveler: {formatINR(Math.round(budget.perTraveler))}
                </Text>
                {budget.hasUnpriced ? (
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>
                    One or more packages in this plan have no listed price
                    and are counted as ₹0 here — ask the team for their
                    price before relying on this estimate.
                  </Text>
                ) : null}

                <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                  Pre-trip checklist (generic items)
                </Text>
                <Text style={[styles.sub, { color: colors.muted }]}>
                  Generic items only — no per-operator or per-destination
                  requirements are stated here.
                </Text>
                {GENERIC_CHECKLIST.map((item) => {
                  const checked = selected.checkedChecklist.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.row, { borderColor: colors.border }]}
                      onPress={() =>
                        updateSelected({
                          checkedChecklist: checked
                            ? selected.checkedChecklist.filter(
                                (id) => id !== item.id,
                              )
                            : [...selected.checkedChecklist, item.id],
                        })
                      }>
                      <Text style={[styles.rowText, { color: colors.text }]}>
                        {checked ? '✓ ' : '○ '}
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </>
        )}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Build my itinerary (filter matching, not AI)
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Answer three prompts and matching packages from the real
          catalogue are listed. Preferred dates are a note for your
          enquiry — the catalogue has no departure dates, so dates never
          filter results.
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Budget cap in ₹ (optional)"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={quizBudget}
          onChangeText={setQuizBudget}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Interests, e.g. goa beach family"
          placeholderTextColor={colors.muted}
          value={quizInterests}
          onChangeText={setQuizInterests}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Preferred travel dates (note only)"
          placeholderTextColor={colors.muted}
          value={quizDates}
          onChangeText={setQuizDates}
        />
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => setQuizRan(true)}>
          <Text style={styles.buttonText}>Find matching packages</Text>
        </Pressable>
        {quizRan ? (
          quizResults.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              No packages matched. Try a higher budget cap or broader
              interests. Packages without a listed price are not shown
              when a budget cap is set.
            </Text>
          ) : (
            quizResults.slice(0, 10).map((pkg) => (
              <View key={pkg.slug} style={[styles.row, { borderColor: colors.border }]}>
                <Text style={[styles.rowText, { color: colors.text }]}>
                  {pkg.title} — {priceLine(pkg)}
                </Text>
                <Pressable
                  style={[styles.smallButton, { borderColor: colors.primary }]}
                  onPress={() => openPackage(pkg)}>
                  <Text style={[styles.smallText, { color: colors.primary }]}>
                    View
                  </Text>
                </Pressable>
              </View>
            ))
          )
        ) : null}

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Recently viewed & compared
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Private, on this device only. Clear it any time.
        </Text>
        {viewed.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Nothing viewed yet from the planner or trip screens.
          </Text>
        ) : (
          viewed.map((entry) => (
            <Pressable
              key={entry.slug}
              style={[styles.row, { borderColor: colors.border }]}
              onPress={() => {
                const pkg = catalog.packages.find(
                  (p) => p.slug === entry.slug,
                );
                if (pkg !== undefined) openPackage(pkg);
              }}>
              <Text style={[styles.rowText, { color: colors.text }]}>
                {titleOf(catalog.packages, entry.slug)}
              </Text>
            </Pressable>
          ))
        )}
        {compared.length > 0 ? (
          <Text style={[styles.cardMeta, { color: colors.muted }]}>
            Compared: {compared.map((s) => titleOf(catalog.packages, s)).join(', ')}
          </Text>
        ) : null}
        <Pressable
          style={[styles.button, styles.outlineButton, { borderColor: colors.primary }]}
          onPress={() => {
            void clearViewed().then(() => setViewed([]));
          }}>
          <Text style={[styles.buttonText, { color: colors.primary }]}>
            Clear viewed history
          </Text>
        </Pressable>

        <Text style={[styles.section, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          Festival / season calendar
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Not shown: no verified, structured festival dates were found in
          the app catalogue or content, so no dates are listed rather
          than guessed. Ask the team about the best months for a
          destination.
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Sharing a plan sends text only — PDF export is deferred (no PDF
          library is installed).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { fontWeight: WEIGHT.bold },
  sub: { fontSize: FONT.body, marginTop: SPACING.sm, lineHeight: 22 },
  section: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  empty: { fontSize: FONT.body, marginTop: SPACING.md, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    fontSize: FONT.body,
  },
  chipRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  chip: {
    borderWidth: 1,
    borderRadius: RADII.pill,
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  chipText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  outlineButton: { borderWidth: 1, backgroundColor: 'transparent' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  card: {
    borderWidth: 1,
    borderRadius: RADII.card,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  cardMain: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  cardTitle: { fontSize: FONT.heading, fontWeight: WEIGHT.bold },
  cardMeta: { fontSize: FONT.meta, marginTop: SPACING.xs, lineHeight: 18 },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  smallButton: {
    borderWidth: 1,
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  smallText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
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
  result: { fontSize: FONT.body, marginTop: SPACING.md, lineHeight: 24 },
});
