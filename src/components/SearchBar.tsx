/**
 * Search input (v1.3 item 21). Plain text input with a clear button.
 * Deliberately NO microphone button: voice search (item 30) is
 * DEFERRED (see src/lib/search.ts header) and a mic icon that does
 * nothing — or pretends to listen — would be a fake feature.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, FONT, RADII, SPACING, TOUCH_MIN } from '../theme/tokens';

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
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.button,
    paddingLeft: SPACING.lg,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_MIN,
    fontSize: FONT.body,
    color: COLORS.text,
  },
  clearButton: {
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: FONT.body,
    color: COLORS.muted,
  },
});
