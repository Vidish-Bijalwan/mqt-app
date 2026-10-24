import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FONT, SPACING, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { PackageImage } from './PackageImage';

interface Props {
  /** Photo URLs. Today a package has exactly one image, so this is
   *  normally a single-element array — extra photos are never invented
   *  here; the array form exists so future photos work unchanged. */
  photos: (string | null)[];
  height?: number;
}

/**
 * Swipe gallery (item 111a): horizontal paging FlatList of the package's
 * real photos, with an honest photo count ("1 photo" — not a gallery
 * pretending to hold more). One photo today, swipe enabled regardless.
 */
export function PackageGallery({ photos, height = 260 }: Props) {
  const { colors, fs } = useSettings();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (photos.length === 0 || photos.every((p) => !p)) {
    return (
      <View style={[styles.placeholder, { height, backgroundColor: colors.placeholderBg }]}>
        <Text style={[styles.placeholderText, { color: colors.placeholderText, fontSize: fs(14) }]}>Photo unavailable</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(
            e.nativeEvent.contentOffset.x / Math.max(width, 1),
          );
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <PackageImage uri={item} height={height} />
          </View>
        )}
      />
      <View style={styles.counterWrap}>
        <Text style={[styles.counter, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          {photos.length === 1
            ? '1 photo'
            : `${index + 1} of ${photos.length} photos`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
  },
  counterWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    alignItems: 'flex-end',
  },
  counter: {
    fontSize: FONT.meta,
    fontWeight: WEIGHT.medium,
  },
});
