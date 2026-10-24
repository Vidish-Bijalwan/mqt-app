import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { whatsappUrl } from '../lib/contact';
import { useSettings } from '../context/SettingsContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaySuccess'>;

export function PaySuccessScreen({ route, navigation }: Props) {
  const { colors, fs } = useSettings();
  const styles = makeStyles(colors, fs);
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
        onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}>
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: { background: string; text: string; muted: string; border: string; primary: string; estimatedBg: string; errorBg: string; errorText: string; inputBg: string }, fs: (base: number) => number) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 32 },
  title: { fontSize: fs(22), fontWeight: '700', color: colors.text },
  text: { fontSize: fs(16), color: colors.text, marginTop: 10, lineHeight: 22 },
  bold: { fontWeight: '700' },
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: '#FFFFFF', fontSize: fs(16), fontWeight: '700' },
  secondaryButtonText: { color: colors.primary, fontSize: fs(16), fontWeight: '700' },
});
}
