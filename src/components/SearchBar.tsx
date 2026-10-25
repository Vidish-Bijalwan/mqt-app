/**
 * Search input (v1.3 item 21). Plain text input with a clear button.
 * Deliberately NO microphone button: voice search (item 30) is
 * DEFERRED (see src/lib/search.ts header) and a mic icon that does
 * nothing — or pretends to listen — would be a fake feature.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FONT, RADII, SPACING, TOUCH_MIN } from '../theme/tokens';
import type { Palette } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search packages or destinations…',
}: Props) {
  const { colors } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search packages"
      />
      {value !== '' ? (
        <Pressable
          onPress={() => onChangeText('')}
          style={styles.clearButton}
          accessibilityLabel="Clear search">
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: RADII.button,
    paddingLeft: SPACING.lg,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_MIN,
    fontSize: FONT.body,
    color: c.text,
  },
  clearButton: {
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: FONT.body,
    color: c.muted,
  },
  });
}
