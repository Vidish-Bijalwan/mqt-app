/**
 * Travelers (v1.2): CRUD traveler profiles stored ONLY on this device
 * (AsyncStorage via src/lib/settings.ts). Fields: name, adult/child
 * band, optional relation. Travelers are used to prefill enquiries in a
 * later step — nothing here is synced to an account.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  addTraveler,
  deleteTraveler,
  listTravelers,
  updateTraveler,
} from '../lib/settings';
import type { Traveler, TravelerBand } from '../lib/settings';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

export function TravelersScreen() {
  const { colors, fs, t } = useSettings();
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [name, setName] = useState('');
  const [band, setBand] = useState<TravelerBand>('adult');
  const [relation, setRelation] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    void listTravelers().then(setTravelers);
  }, []);
  useFocusEffect(reload);

  function resetForm() {
    setName('');
    setBand('adult');
    setRelation('');
    setEditingId(null);
  }

  async function handleSave() {
    if (name.trim() === '') return;
    if (editingId !== null) {
      setTravelers(
        await updateTraveler(editingId, {
          name: name.trim(),
          band,
          relation: relation.trim(),
        }),
      );
    } else {
      setTravelers(
        await addTraveler({ name: name.trim(), band, relation: relation.trim() }),
      );
    }
    resetForm();
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          {t('travelers')}
        </Text>
        <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          Traveler profiles are saved on this device only.
        </Text>

        {travelers.length === 0 ? (
          <Text style={[styles.note, { color: colors.muted, fontSize: fs(FONT.body) }]}>
            No travelers saved yet. Add the people you usually travel with.
          </Text>
        ) : (
          travelers.map((tr) => (
            <View key={tr.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
                {tr.name}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted, fontSize: fs(FONT.body) }]}>
                {tr.band === 'adult' ? 'Adult' : 'Child'}
                {tr.relation !== '' ? ` · ${tr.relation}` : ''}
              </Text>
              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.smallButton, styles.outlineSmall]}
                  onPress={() => {
                    setEditingId(tr.id);
                    setName(tr.name);
                    setBand(tr.band);
                    setRelation(tr.relation);
                  }}>
                  <Text style={[styles.smallButtonText, { color: colors.primary }]}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallButton, styles.dangerSmall]}
                  onPress={() => void deleteTraveler(tr.id).then(setTravelers)}>
                  <Text style={styles.smallButtonTextDanger}>{t('delete')}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(FONT.heading) }]}>
          {editingId !== null ? 'Edit traveler' : 'Add traveler'}
        </Text>
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Name *</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={name}
          onChangeText={setName}
          placeholder="Traveler’s full name"
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="words"
        />
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Age band</Text>
        <View style={styles.bandRow}>
          {(['adult', 'child'] as const).map((b) => (
            <Pressable
              key={b}
              style={[
                styles.band,
                {
                  borderColor: band === b ? colors.primary : colors.border,
                  backgroundColor: band === b ? colors.primary : colors.background,
                },
              ]}
              onPress={() => setBand(b)}>
              <Text style={[styles.bandText, { color: band === b ? '#FFFFFF' : colors.text }]}>
                {b === 'adult' ? 'Adult' : 'Child'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.label, { color: colors.text, fontSize: fs(FONT.body) }]}>Relation (optional)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={relation}
          onChangeText={setRelation}
          placeholder="e.g. Spouse, Child, Friend"
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="words"
        />
        <Pressable
          style={[styles.button, styles.primaryButton, name.trim() === '' ? styles.disabled : null]}
          onPress={handleSave}
          disabled={name.trim() === ''}>
          <Text style={styles.buttonText}>
            {editingId !== null ? 'Save changes' : t('save')}
          </Text>
        </Pressable>
        {editingId !== null ? (
          <Pressable style={[styles.button, styles.outlineButton]} onPress={resetForm}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>{t('cancel')}</Text>
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
  note: { marginTop: SPACING.sm, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: RADII.card, padding: SPACING.lg, marginTop: SPACING.md },
  cardTitle: { fontWeight: WEIGHT.bold },
  cardMeta: { marginTop: SPACING.xs },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  smallButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.lg,
  },
  outlineSmall: { borderColor: '#127C82' },
  dangerSmall: { borderColor: '#B00020' },
  smallButtonText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  smallButtonTextDanger: { fontSize: FONT.body, fontWeight: WEIGHT.bold, color: '#B00020' },
  sectionTitle: { fontWeight: WEIGHT.bold, marginTop: SPACING.xl },
  label: { fontWeight: WEIGHT.bold, marginTop: SPACING.lg },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: SPACING.sm,
  },
  bandRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  band: {
    flex: 1,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADII.button,
  },
  bandText: { fontSize: FONT.body, fontWeight: WEIGHT.bold },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  primaryButton: { backgroundColor: '#127C82' },
  outlineButton: { borderWidth: 1, borderColor: '#127C82' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
  outlineButtonText: { fontSize: 16, fontWeight: WEIGHT.bold },
});
