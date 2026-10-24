import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BRAND } from '../constants';
import {
  ApiError,
  createRazorpayOrder,
  SITE_BASE,
  type RazorpayOrder,
} from '../lib/api';
import { whatsappUrl } from '../lib/contact';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Pay'>;

const IS_WEB = Platform.OS === 'web';

/**
 * Bundled checkout page. The Razorpay public key id and order id come
 * ONLY from the create-order backend response — nothing is hardcoded.
 * Values are embedded via JSON.stringify so user input cannot break out
 * of the script string context.
 */
function checkoutHtml(order: RazorpayOrder, input: {
  name: string;
  phone: string;
  email: string;
  packageName: string;
}): string {
  const options = {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amountPaise,
    currency: 'INR',
    name: 'My Quick Trippers',
    description: input.packageName,
    prefill: {
      name: input.name,
      contact: input.phone,
      email: input.email,
    },
  };
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="font-family:sans-serif;padding:24px;text-align:center">
<p>Opening secure payment…</p>
<script>
var options = ${JSON.stringify(options).replace(/</g, '\\u003c')};
options.handler = function (response) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', payment_id: response.razorpay_payment_id }));
};
options.modal = { ondismiss: function () {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
} };
try {
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function (response) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', message: (response.error && response.error.description) || 'Payment failed.' }));
  });
  rzp.open();
} catch (e) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', message: 'Could not open the payment window. Please try again.' }));
}
</script></body></html>`;
}

export function PayScreen({ route, navigation }: Props) {
  const { slug, packageName, amount: initialAmount } = route.params;
  const [amount, setAmount] = useState(
    initialAmount > 0 ? String(initialAmount) : '',
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [checkoutInput, setCheckoutInput] = useState<{
    name: string;
    phone: string;
    email: string;
    packageName: string;
  } | null>(null);

  async function handlePay() {
    setError(null);
    const amountNumber = Number(amount.replace(/,/g, '').trim());
    if (IS_WEB) {
      // Web preview: react-native-webview does not run on web, so hand
      // off to the website checkout instead of a fake in-app payment.
      await Linking.openURL(`${SITE_BASE}/pay`);
      return;
    }
    setCreating(true);
    try {
      const created = await createRazorpayOrder({
        amount: amountNumber,
        name: name === '' ? undefined : name,
        phone,
        email: email === '' ? undefined : email,
      });
      setOrder(created);
      setCheckoutInput({
        name,
        phone,
        email,
        packageName,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  }

  // Native checkout phase: the WebView hosts checkout.js only.
  if (order !== null && checkoutInput !== null && !IS_WEB) {
    return (
      <View style={styles.checkoutContainer}>
        <WebView
          source={{ html: checkoutHtml(order, checkoutInput) }}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={(event) => {
            let payload: { type?: string; payment_id?: string; message?: string };
            try {
              payload = JSON.parse(event.nativeEvent.data) as typeof payload;
            } catch {
              return;
            }
            if (payload.type === 'success' && payload.payment_id) {
              // Only a confirmed checkout callback counts as success.
              navigation.navigate('PaySuccess', {
                orderId: order.orderId,
                paymentId: payload.payment_id,
              });
              setOrder(null);
              setCheckoutInput(null);
            } else if (payload.type === 'dismiss') {
              setOrder(null);
              setCheckoutInput(null);
              setError('Payment was closed before completing. No payment was confirmed — you can try again.');
            } else if (payload.type === 'failure') {
              setOrder(null);
              setCheckoutInput(null);
              setError(payload.message ?? 'Payment failed. No payment was confirmed — you can try again.');
            }
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.body}>
      <Text style={styles.packageLabel}>Paying for</Text>
      <Text style={styles.packageName}>{packageName}</Text>

      {initialAmount === 0 ? (
        <Text style={styles.confirmNote}>
          Amount to be confirmed — enter the advance amount
        </Text>
      ) : null}

      <Text style={styles.label}>Amount (₹) *</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 5000"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Phone *</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="10-digit Indian mobile"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {error !== null ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, styles.primaryButton, creating ? styles.disabled : null]}
        onPress={handlePay}
        disabled={creating}>
        {creating ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Pay securely</Text>
        )}
      </Pressable>

      {IS_WEB ? (
        <Text style={styles.note}>
          Web preview opens the website checkout — in the Android/iOS app
          the secure payment opens inside the app.
        </Text>
      ) : (
        <Text style={styles.note}>
          Secure payment via Razorpay. You will be shown the result only
          after the payment provider confirms it.
        </Text>
      )}

      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={() =>
          Linking.openURL(
            whatsappUrl(
              `Hi My Quick Trippers! I need help paying for "${packageName}"${slug ? ` (${slug})` : ''}. Please assist.`,
            ),
          )
        }>
        <Text style={styles.secondaryButtonText}>Need help? WhatsApp us</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.background },
  body: { padding: 16, paddingBottom: 32 },
  checkoutContainer: { flex: 1, backgroundColor: BRAND.background },
  packageLabel: { fontSize: 13, color: BRAND.muted },
  packageName: { fontSize: 18, fontWeight: '700', color: BRAND.text, marginTop: 4 },
  confirmNote: {
    fontSize: 14,
    color: BRAND.text,
    backgroundColor: BRAND.estimatedBackground,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    lineHeight: 20,
  },
  label: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: BRAND.text,
    marginTop: 6,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButton: { backgroundColor: BRAND.primary },
  secondaryButton: { borderWidth: 1, borderColor: BRAND.primary },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: BRAND.primary, fontSize: 16, fontWeight: '700' },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },
  errorText: { fontSize: 14, color: '#7A1F1F', lineHeight: 20 },
  note: { fontSize: 13, color: BRAND.muted, marginTop: 12, lineHeight: 18 },
});
