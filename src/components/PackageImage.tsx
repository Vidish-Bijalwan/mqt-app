import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../constants';

interface Props {
  uri: string | null;
  /** Height of the image area. Width is always full container width. */
  height: number;
}

/**
 * Real package photo from myquicktrippers.com, or an honest grey
 * placeholder when the image is missing or fails to load.
 * NEVER a fake photo or an AI image presented as a real photo.
 */
export function PackageImage({ uri, height }: Props) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>Photo unavailable</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { height }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    backgroundColor: BRAND.placeholderBackground,
  },
  placeholder: {
    width: '100%',
    backgroundColor: BRAND.placeholderBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: BRAND.placeholderText,
    fontSize: 14,
  },
});
