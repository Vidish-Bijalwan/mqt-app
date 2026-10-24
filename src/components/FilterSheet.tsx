import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DURATIONS, FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import {
  BUDGET_BANDS,
  DURATION_BANDS,
  SORT_OPTIONS,
} from '../lib/search';
import type {
  BudgetBandId,
  DurationBandId,
  SearchFilters,
  SortId,
} from '../lib/search';

interface Props {
  visible: boolean;
  categories: string[];
  /** Currently applied category, or null for "All". */
  selected: string | null;
  onClose: () => void;
  onApply: (category: string | null) => void;
  onClear: () => void;
  /**
   * Extended multi-filter mode (v1.3 item 22/23), used by Search and
   * Packages. When onApplyFilters is present the sheet also offers
   * budget bands, duration bands and sort, and Apply/Clear call the
   * extended callbacks instead of the legacy ones. Home keeps using
   * the legacy category-only path unchanged.
   */
  budget?: BudgetBandId | 'all';
  durationBand?: DurationBandId | 'all';
  sort?: SortId;
  onApplyFilters?: (filters: SearchFilters, sort: SortId) => void;
  onClearFilters?: () => void;
}

/**
 * Bottom-sheet filter (item 111c): Modal + Animated slide-up sheet,
 * backdrop dismiss, close button, single-category select + clear/apply.
 * Chips are 48dp tall (TOUCH_MIN) — the old inline chips were ~34dp.
 * Drag-to-expand is not implemented: the sheet is a Modal, not a
 * gesture-driven bottom sheet, and no gesture library is added here.
 */
export function FilterSheet({
  visible,
  categories,
  selected,
  onClose,
  onApply,
  onClear,
  budget = 'all',
  durationBand = 'all',
  sort = 'price-asc',
  onApplyFilters,
  onClearFilters,
}: Props) {
  const extended = onApplyFilters !== undefined;
  const { colors, fs } = useSettings();
  const [draft, setDraft] = useState<string | null>(selected);
  const [draftBudget, setDraftBudget] = useState<BudgetBandId | 'all'>(budget);
  const [draftDuration, setDraftDuration] =
    useState<DurationBandId | 'all'>(durationBand);
  const [draftSort, setDraftSort] = useState<SortId>(sort);
  const [slide] = useState(() => new Animated.Value(400));
  // Sync drafts when the sheet opens, via the render-phase adjustment
  // pattern (not an effect): opening with stale drafts would apply
  // the previous session's values, and setState-in-effect is lint-banned.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setDraft(selected);
    setDraftBudget(budget);
    setDraftDuration(durationBand);
    setDraftSort(sort);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  useEffect(() => {
    if (visible) {
      slide.setValue(400);
      Animated.timing(slide, {
        toValue: 0,
        duration: DURATIONS.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slide]);

  const close = () => {
    // Reset the draft on close so the next open starts from the applied
    // selection (replaces the old sync-on-open effect).
    setDraft(selected);
    setDraftBudget(budget);
    setDraftDuration(durationBand);
    setDraftSort(sort);
    Animated.timing(slide, {
      toValue: 400,
      duration: DURATIONS.fast,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const handleApply = () => {
    if (onApplyFilters !== undefined) {
      onApplyFilters(
        { category: draft, budget: draftBudget, duration: draftDuration },
        draftSort,
      );
    } else {
      onApply(draft);
    }
    close();
  };

  const handleClear = () => {
    if (onClearFilters !== undefined) {
      onClearFilters();
    } else {
      onClear();
    }
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropPress}
          onPress={close}
          accessibilityLabel="Close filters"
        />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slide }], backgroundColor: colors.background }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>Filters</Text>
            <Pressable
              onPress={close}
              style={styles.closeButton}
              accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.options}>
            <Text style={[styles.sectionLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>Category</Text>
            <View style={styles.chipsWrap}>
              <FilterChip
                label="All"
                active={draft === null}
                onPress={() => setDraft(null)}
              />
              {categories.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={draft === c}
                  onPress={() => setDraft(c)}
                />
              ))}
            </View>
            {extended ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>Budget</Text>
                <View style={styles.chipsWrap}>
                  <FilterChip
                    label="Any budget"
                    active={draftBudget === 'all'}
                    onPress={() => setDraftBudget('all')}
                  />
                  {BUDGET_BANDS.map((b) => (
                    <FilterChip
                      key={b.id}
                      label={b.label}
                      active={draftBudget === b.id}
                      onPress={() => setDraftBudget(b.id)}
                    />
                  ))}
                </View>
                <Text style={[styles.sectionLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>Duration</Text>
                <View style={styles.chipsWrap}>
                  <FilterChip
                    label="Any duration"
                    active={draftDuration === 'all'}
                    onPress={() => setDraftDuration('all')}
                  />
                  {DURATION_BANDS.map((b) => (
                    <FilterChip
                      key={b.id}
                      label={b.label}
                      active={draftDuration === b.id}
                      onPress={() => setDraftDuration(b.id)}
                    />
                  ))}
                </View>
                <Text style={[styles.sectionLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>Sort by</Text>
                <View style={styles.chipsWrap}>
                  {SORT_OPTIONS.map((o) => (
                    <FilterChip
                      key={o.id}
                      label={o.label}
                      active={draftSort === o.id}
                      onPress={() => setDraftSort(o.id)}
                    />
                  ))}
                </View>
                <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
                  Month of travel, group type and transport mode are not
                  offered as filters: the catalogue has no field for
                  them.
                </Text>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, styles.clearButton, { borderColor: colors.primary }]}
              onPress={handleClear}>
              <Text style={[styles.clearButtonText, { color: colors.primary, fontSize: fs(FONT.body) }]}>Clear</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={handleApply}>
              <Text style={[styles.applyButtonText, { fontSize: fs(FONT.body) }]}>Apply</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, fs } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: colors.border },
        active && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}>
      <Text
        style={[
          styles.chipText,
          { color: colors.text, fontSize: fs(14) },
          active && styles.chipTextActive,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: RADII.card,
    borderTopRightRadius: RADII.card,
    maxHeight: '75%',
    paddingBottom: SPACING.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  sheetTitle: {
    fontSize: FONT.heading,
    fontWeight: WEIGHT.bold,
  },
  closeButton: {
    marginLeft: 'auto',
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: FONT.heading,
  },
  options: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  sectionLabel: {
    fontSize: FONT.meta,
    fontWeight: WEIGHT.bold,
    marginBottom: SPACING.sm,
  },
  note: {
    fontSize: FONT.meta,
    lineHeight: 18,
    paddingBottom: SPACING.lg,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  chip: {
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: 14,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
  },
  chipActive: {
  },
  chipText: {
    fontSize: 14,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: WEIGHT.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minHeight: TOUCH_MIN,
    borderRadius: RADII.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
  },
  applyButton: {
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: FONT.body,
    fontWeight: WEIGHT.bold,
  },
});
