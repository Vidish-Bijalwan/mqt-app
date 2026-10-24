import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BRAND } from '../constants';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  enquiryMessage,
  whatsappAction,
} from '../lib/contact';
import { packageImageUrl, packages } from '../data/packages';
import { getPriceInfo } from '../lib/price';
import type { RootStackParamList } from '../navigation/types';
import { PackageImage } from '../components/PackageImage';
import { PriceBlock } from '../components/PriceBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'PackageDetail'>;

export function PackageDetailScreen({ route, navigation }: Props) {
  const pkg = packages.find((p) => p.slug === route.params.slug);

  if (!pkg) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>
          Sorry, this package could not be found.
        </Text>
      </View>
    );
  }

  const price = getPriceInfo(pkg);

  return (
    <ScrollView style={styles.container}>
      <PackageImage uri={packageImageUrl(pkg)} height={260} />
      <View style={styles.body}>
        <Text style={styles.title}>{pkg.title}</Text>
        <Text style={styles.meta}>
          {pkg.category}
          {pkg.duration ? `  ·  ${pkg.duration}` : ''}
        </Text>

        <PriceBlock price={price} />
        <Text style={styles.priceNote}>
          Prices as listed on myquicktrippers.com; final quote is confirmed
          on enquiry.
        </Text>

        {pkg.route !== '' ? (
          <>
            <Text style={styles.sectionHeading}>Route</Text>
            <Text style={styles.sectionText}>{pkg.route}</Text>
          </>
        ) : null}

        {pkg.description !== '' ? (
          <>
            <Text style={styles.sectionHeading}>About this trip</Text>
            <Text style={styles.sectionText}>{pkg.description}</Text>
          </>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() =>
              navigation.navigate('Enquiry', {
                slug: pkg.slug,
                packageName: pkg.title,
              })
            }>
            <Text style={styles.primaryButtonText}>Enquire</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() =>
              navigation.navigate('Pay', {
                slug: pkg.slug,
                packageName: pkg.title,
                // Numeric deal price when priced, else 0 = "to be confirmed".
                amount: price.hasPrice ? price.deal : 0,
              })
            }>
            <Text style={styles.primaryButtonText}>Pay</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => callAction()}>
            <Text style={styles.secondaryButtonText}>
              Call {CONTACT_PHONE_DISPLAY}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => whatsappAction(enquiryMessage(pkg.title))}>
            <Text style={styles.secondaryButtonText}>WhatsApp</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  body: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND.text,
  },
  meta: {
    fontSize: 14,
    color: BRAND.muted,
    marginTop: 6,
  },
  priceNote: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
    marginTop: 20,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
    color: BRAND.text,
    marginTop: 6,
  },
  actions: {
    marginTop: 24,
    gap: 10,
    paddingBottom: 24,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: BRAND.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  secondaryButtonText: {
    color: BRAND.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: BRAND.background,
  },
  notFoundText: {
    fontSize: 16,
    color: BRAND.muted,
    textAlign: 'center',
  },
});
