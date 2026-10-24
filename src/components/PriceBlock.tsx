import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { PriceInfo } from '../lib/price';

interface Props {
  price: PriceInfo;
}

/**
 * The ONLY price UI in the app. Prices come from getPriceInfo() — never
 * from a package's raw mrp/dealPrice fields. When hasPrice is false this
 * renders "Pricing on request" and no number at all.
 */
export function PriceBlock({ price }: Props) {
  const { colors, fs } = useSettings();
  const styles = makeStyles(colors, fs);
  if (!price.hasPrice) {
    return (
      <View style={styles.container}>
        <Text style={styles.onRequest}>Pricing on request</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.display}>{price.display}</Text>
        {price.crossed !== '' ? (
          <Text style={styles.crossed}>{price.crossed}</Text>
        ) : null}
      </View>
      <View style={styles.row}>
        {price.save !== '' ? (
          <Text style={styles.save}>Save {price.save}</Text>
        ) : null}
        {price.estimated ? (
          <Text style={styles.estimated}>Estimated</Text>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(colors: { text: string; muted: string; primary: string; estimatedBg: string; estimatedText: string }, fs: (base: number) => number) {
  return StyleSheet.create({
  container: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  display: {
    fontSize: fs(18),
    fontWeight: WEIGHT.bold,
    color: colors.text,
  },
  crossed: {
    fontSize: fs(14),
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  save: {
    fontSize: fs(13),
    fontWeight: WEIGHT.medium,
    color: colors.primary,
  },
  estimated: {
    fontSize: fs(12),
    fontWeight: WEIGHT.medium,
    color: colors.estimatedText,
    backgroundColor: colors.estimatedBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  onRequest: {
    fontSize: fs(15),
    fontWeight: WEIGHT.medium,
    color: colors.muted,
  },
});
}
