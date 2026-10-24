import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ApiError,
  createRazorpayOrder,
  SITE_BASE,
  type RazorpayOrder,
} from '../lib/api';
import { whatsappUrl } from '../lib/contact';
import {
  openCheckout,
  RazorpayNativeUnavailableError,
} from '../lib/razorpayNative';
import { TOUCH_MIN } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Pay'>;

const IS_WEB = Platform.OS === 'web';

/**
 * Bundled checkout page, used ONLY as the load-failure fallback when the
 * native Razorpay SDK is unavailable in this build (see below). The
 * normal native path is the SDK via openCheckout — never this WebView.
 * The Razorpay public key id and order id come ONLY from the create-order
 * backend response — nothing is hardcoded. Values are embedded via
 * JSON.stringify so user input cannot break out of the script string
 * context.
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
  const { colors, fs } = useSettings();
  const styles = makeStyles(colors, fs);
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
  // True only after the native SDK failed to load: the form stays usable
  // (retry + WhatsApp help) and the WebView fallback below is offered.
  const [sdkUnavailable, setSdkUnavailable] = useState(false);
  const [useWebFallback, setUseWebFallback] = useState(false);

  function resetCheckoutState() {
    setOrder(null);
    setCheckoutInput(null);
    setSdkUnavailable(false);
    setUseWebFallback(false);
  }

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
      // Kept so the WebView fallback can use this order if — and only
      // if — the native SDK turns out to be unavailable below.
      setOrder(created);
      setCheckoutInput({
        name,
        phone,
        email,
        packageName,
      });
      setSdkUnavailable(false);
      // Normal native path: the Razorpay SDK, not the WebView. The key,
      // order id and amount come only from `created`.
      const result = await openCheckout({
        key: created.keyId,
        orderId: created.orderId,
        amountPaise: created.amountPaise,
        description: packageName,
        name,
        contact: phone,
        email,
      });
      // Only a confirmed SDK success counts as success.
      navigation.navigate('PaySuccess', {
        orderId: created.orderId,
        paymentId: result.paymentId,
      });
      resetCheckoutState();
    } catch (err) {
      if (err instanceof RazorpayNativeUnavailableError) {
        // Graceful, never a crash: the form stays on screen with the
        // existing WhatsApp help button, retry is allowed, and the
        // WebView checkout is offered as an explicit fallback.
        setError(err.message);
        setSdkUnavailable(true);
      } else if (err instanceof ApiError) {
        setError(err.message);
        resetCheckoutState();
      } else if (err instanceof Error) {
        setError(err.message);
        resetCheckoutState();
      } else {
        setError('Something went wrong. Please try again.');
        resetCheckoutState();
      }
    } finally {
      setCreating(false);
    }
  }

  // Load-failure fallback ONLY: shown after the user explicitly chooses
  // it when the native SDK was unavailable. The WebView hosts
  // checkout.js, exactly as the old native path did.
  if (useWebFallback && order !== null && checkoutInput !== null && !IS_WEB) {
    return (
      <SafeAreaView style={styles.checkoutContainer}>
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
              resetCheckoutState();
            } else if (payload.type === 'dismiss') {
              resetCheckoutState();
              setError('Payment was closed before completing. No payment was confirmed — you can try again.');
            } else if (payload.type === 'failure') {
              resetCheckoutState();
              setError(payload.message ?? 'Payment failed. No payment was confirmed — you can try again.');
            }
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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

        {sdkUnavailable && order !== null && checkoutInput !== null ? (
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setUseWebFallback(true)}>
            <Text style={styles.secondaryButtonText}>
              Try web checkout instead
            </Text>
          </Pressable>
        ) : null}

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
    </SafeAreaView>
  );
}

function makeStyles(colors: { background: string; text: string; muted: string; border: string; primary: string; estimatedBg: string; errorBg: string; errorText: string; inputBg: string }, fs: (base: number) => number) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 32 },
  checkoutContainer: { flex: 1, backgroundColor: colors.background },
  packageLabel: { fontSize: fs(13), color: colors.muted },
  packageName: { fontSize: fs(18), fontWeight: '700', color: colors.text, marginTop: 4 },
  confirmNote: {
    fontSize: fs(14),
    color: colors.text,
    backgroundColor: colors.estimatedBg,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    lineHeight: 20,
  },
  label: { fontSize: fs(14), fontWeight: '700', color: colors.text, marginTop: 16 },
  input: {
    borderWidth: 1,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: TOUCH_MIN,
    fontSize: fs(16),
    color: colors.text,
    marginTop: 6,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: fs(16), fontWeight: '700' },
  secondaryButtonText: { color: colors.primary, fontSize: fs(16), fontWeight: '700' },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.errorBg,
  },
  errorText: { fontSize: fs(14), color: colors.errorText, lineHeight: 20 },
  note: { fontSize: fs(13), color: colors.muted, marginTop: 12, lineHeight: 18 },
});
}
