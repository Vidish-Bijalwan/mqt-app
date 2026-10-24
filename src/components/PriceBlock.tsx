import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../constants';
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

const styles = StyleSheet.create({
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
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.text,
  },
  crossed: {
    fontSize: 14,
    color: BRAND.muted,
    textDecorationLine: 'line-through',
  },
  save: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.primary,
  },
  estimated: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.estimatedText,
    backgroundColor: BRAND.estimatedBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  onRequest: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.muted,
  },
});
