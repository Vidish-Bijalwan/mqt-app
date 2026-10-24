import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BRAND } from '../constants';
import { whatsappUrl } from '../lib/contact';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaySuccess'>;

export function PaySuccessScreen({ route, navigation }: Props) {
  const { orderId, paymentId } = route.params;
  const whatsappMessage =
    `Hi My Quick Trippers! I just completed a payment in the app.` +
    (orderId ? ` Order ID: ${orderId}.` : '') +
    (paymentId ? ` Payment ID: ${paymentId}.` : '') +
    ` Please confirm my booking.`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.body}>
      <Text style={styles.title}>Payment successful</Text>
      <Text style={styles.text}>
        Your payment was confirmed by the payment provider.
      </Text>
      {orderId ? (
        <Text style={styles.text}>
          Order ID: <Text style={styles.bold}>{orderId}</Text>
        </Text>
      ) : null}
      {paymentId ? (
        <Text style={styles.text}>
          Payment ID: <Text style={styles.bold}>{paymentId}</Text>
        </Text>
      ) : null}
      <Text style={styles.text}>
        Please share these IDs with the team on WhatsApp so your booking
        can be confirmed against them.
      </Text>
      <Pressable
        style={[styles.button, styles.primaryButton]}
        onPress={() => Linking.openURL(whatsappUrl(whatsappMessage))}>
        <Text style={styles.buttonText}>WhatsApp team</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate('Home')}>
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  body: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: BRAND.text },
  text: { fontSize: 16, color: BRAND.text, marginTop: 10, lineHeight: 22 },
  bold: { fontWeight: '700' },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButton: { backgroundColor: BRAND.primary },
  secondaryButton: { borderWidth: 1, borderColor: BRAND.primary },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: BRAND.primary, fontSize: 16, fontWeight: '700' },
});
