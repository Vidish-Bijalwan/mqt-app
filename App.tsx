import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import {
  NavigationContainer,
  createNavigationContainerRef,
  useNavigation,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { APP_VERSION, BRAND } from './src/constants';
import type { RootStackParamList } from './src/navigation/types';
import { TabNavigator } from './src/navigation/TabNavigator';
import { PackageDetailScreen } from './src/screens/PackageDetailScreen';
import { BookingScreen } from './src/screens/BookingScreen';
import { EnquiryScreen } from './src/screens/EnquiryScreen';
import { PayScreen } from './src/screens/PayScreen';
import { BlogScreen } from './src/screens/BlogScreen';
import { BlogArticleScreen } from './src/screens/BlogArticleScreen';
import { TravelersScreen } from './src/screens/TravelersScreen';
import { SupportChatScreen } from './src/screens/SupportChatScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { DataPrivacyScreen } from './src/screens/DataPrivacyScreen';
import { MaintenanceScreen } from './src/screens/MaintenanceScreen';
import { ForcedUpdateScreen } from './src/screens/ForcedUpdateScreen';
import { PaySuccessScreen } from './src/screens/PaySuccessScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { CompareScreen } from './src/screens/CompareScreen';
import { NotificationCenter } from './src/screens/NotificationCenter';
// v2 screens (items 81–90, 93–100, 151–160, 171–180, 181–200, 205–210).
import { PlannerScreen } from './src/screens/PlannerScreen';
import { TripDetailScreen } from './src/screens/TripDetailScreen';
import { BlogLibraryScreen } from './src/screens/BlogLibraryScreen';
import { BlogVideoGuidesScreen } from './src/screens/BlogVideoGuidesScreen';
import { DestinationHubsScreen } from './src/screens/DestinationHubsScreen';
import { DestinationHubScreen } from './src/screens/DestinationHubScreen';
import { TripKitScreen } from './src/screens/TripKitScreen';
import { OfflineDiagnosticsScreen } from './src/screens/OfflineDiagnosticsScreen';
import { TrustScreen } from './src/screens/TrustScreen';
import { OffersScreen } from './src/screens/OffersScreen';
import { ReferralScreen } from './src/screens/ReferralScreen';
import { InviteScreen } from './src/screens/InviteScreen';
import { ReportIssueScreen } from './src/screens/ReportIssueScreen';
import { GroupEnquiryScreen } from './src/screens/GroupEnquiryScreen';
import { GiftTripScreen } from './src/screens/GiftTripScreen';
import { WhatsNewScreen } from './src/screens/WhatsNewScreen';
import { DiagnosticsScreen } from './src/screens/DiagnosticsScreen';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { CatalogProvider } from './src/lib/catalog';
import { decideUpdatePrompt, useAppConfig } from './src/lib/appConfig';
import { whatsappAction } from './src/lib/contact';
import {
  initNotifications,
  registerNotificationNavigation,
} from './src/lib/notifications';
import {
  loadLastSeenVersion,
  markWhatsNewSeen,
  shouldShowWhatsNew,
} from './src/lib/whatsNew';
import { markAppReady } from './src/lib/diagnostics';
import {
  flushEnquiryQueue,
  registerForegroundFlush,
} from './src/lib/drafts';
import { submitEnquiry } from './src/lib/api';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Controlled launch screen (v2.0.2, SDK 58 expo-splash-screen, verified
 * against the versioned docs). preventAutoHideAsync() MUST run at
 * module scope — the docs warn that calling it inside a component or
 * hook can run too late, after the splash already hid. The native
 * splash itself is the existing app.json config: the white MQT INDIA
 * lockup (assets/splash-icon-v2.png) on teal (#127C82); the launcher
 * icon (assets/icon.png) is untouched. hideAsync() runs from App()
 * once the first render is ready, after a short minimum display
 * (600ms from module load) so the lockup is actually seen rather than
 * flashing past. Fade-out is configured per reduced-motion in App().
 */
const APP_START_MS = Date.now();
const MIN_SPLASH_MS = 600;
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * v2 wrappers: Trust / Offers / ReportIssue / GroupEnquiry / GiftTrip
 * take callback/prop inputs (not route props), so thin adapters map
 * stack route params to their props. Navigation stays inside the
 * NavigationContainer, so the screens' own useNavigation calls work.
 */
function TrustRoute({ route }: NativeStackScreenProps<RootStackParamList, 'Trust'>) {
  const navigation = useNavigation<AppNavigation>();
  return (
    <TrustScreen
      packageName={route.params?.packageName}
      onReportIssue={() =>
        navigation.navigate('ReportIssue', {
          packageName: route.params?.packageName,
        })
      }
    />
  );
}

function OffersRoute() {
  const navigation = useNavigation<AppNavigation>();
  return (
    <OffersScreen
      onGroupEnquiry={() => navigation.navigate('GroupEnquiry', undefined)}
      onGiftTrip={() => navigation.navigate('GiftTrip', undefined)}
      onReferral={() => navigation.navigate('Referral')}
      onInvite={() => navigation.navigate('Invite')}
    />
  );
}

function ReportIssueRoute({ route }: NativeStackScreenProps<RootStackParamList, 'ReportIssue'>) {
  return (
    <ReportIssueScreen
      packageName={route.params?.packageName}
      packageRef={route.params?.packageRef}
    />
  );
}

function GroupEnquiryRoute({ route }: NativeStackScreenProps<RootStackParamList, 'GroupEnquiry'>) {
  return <GroupEnquiryScreen packageName={route.params?.packageName} />;
}

function GiftTripRoute({ route }: NativeStackScreenProps<RootStackParamList, 'GiftTrip'>) {
  return <GiftTripScreen packageName={route.params?.packageName} />;
}

/** Calls markAppReady() exactly once when the main stack first renders. */
function MarkReady() {
  useEffect(() => {
    markAppReady();
  }, []);
  return null;
}

/**
 * Launch gate (v1.2), inside the NavigationContainer so the gate screens
 * can use navigation-adjacent helpers. Order: maintenance first, then a
 * forced update, then What's New (post-update interstitial, never on
 * fresh install, never before the gates above), then the app with an
 * optional dismissible soft-update nudge on top. When config is still
 * loading or unavailable (offline, no cache), the app itself is shown
 * rather than blocking the user — the gate applies as soon as a config
 * resolves. No download link is ever invented: the app is not on Google
 * Play yet, so update actions go through WhatsApp/call to the team.
 */
function LaunchGate({ reduceMotion }: { reduceMotion: boolean }) {
  const { config, refresh } = useAppConfig();
  const { colors } = useSettings();
  const [softDismissed, setSoftDismissed] = useState(false);
  const [whatsNew, setWhatsNew] = useState<{ show: boolean; since?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const last = await loadLastSeenVersion();
      if (!alive) return;
      if (last === null) {
        await markWhatsNewSeen(APP_VERSION);
        setWhatsNew({ show: false });
      } else if (shouldShowWhatsNew(last, APP_VERSION)) {
        setWhatsNew({ show: true, since: last });
      } else {
        setWhatsNew({ show: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (config !== null && config.maintenance.enabled) {
    return (
      <MaintenanceScreen
        message={config.maintenance.message}
        onRetry={refresh}
      />
    );
  }

  const prompt =
    config !== null ? decideUpdatePrompt(config, APP_VERSION) : null;
  if (prompt !== null && prompt.type === 'forced') {
    return (
      <ForcedUpdateScreen
        latestVersion={prompt.latestVersion}
        onRetry={refresh}
      />
    );
  }

  if (whatsNew !== null && whatsNew.show) {
    return (
      <WhatsNewScreen
        sinceVersion={whatsNew.since}
        onDone={() => {
          void (async () => {
            await markWhatsNewSeen(APP_VERSION);
            setWhatsNew({ show: false });
          })();
        }}
      />
    );
  }

  const showSoftNudge =
    prompt !== null && prompt.type === 'soft' && !softDismissed;

  return (
    <View style={styles.gateWrap}>
      <MarkReady />
      {showSoftNudge ? (
        <View style={[styles.nudge, { backgroundColor: colors.estimatedBg }]}>
          <Text style={[styles.nudgeText, { color: colors.text }]}>
            A newer version of the app is available
            {prompt.latestVersion !== '' ? ` (${prompt.latestVersion})` : ''}.
            Ask the team for the latest version.
          </Text>
          <View style={styles.nudgeRow}>
            <Pressable
              style={[styles.nudgeButton, styles.nudgePrimary]}
              onPress={() =>
                whatsappAction(
                  `Hi My Quick Trippers! Please send me the latest app version${prompt.latestVersion !== '' ? ` (${prompt.latestVersion})` : ''}.`,
                )
              }>
              <Text style={styles.nudgeButtonText}>Ask on WhatsApp</Text>
            </Pressable>
            <Pressable
              style={styles.nudgeButton}
              onPress={() => setSoftDismissed(true)}>
              <Text style={[styles.nudgeButtonText, { color: colors.primary }]}>
                Update later
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Stack.Navigator
        initialRouteName="Tabs"
        screenOptions={{
          headerStyle: { backgroundColor: BRAND.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          animation: reduceMotion ? 'none' : 'default',
          animationDuration: reduceMotion ? 0 : 180,
        }}>
        <Stack.Screen
          name="Tabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PackageDetail"
          component={PackageDetailScreen}
          options={{ title: 'Package details' }}
        />
        <Stack.Screen
          name="SupportChat"
          component={SupportChatScreen}
          options={{ title: 'MQT Support' }}
        />
        <Stack.Screen
          name="Enquiry"
          component={EnquiryScreen}
          options={{ title: 'Enquire' }}
        />
        <Stack.Screen
          name="Booking"
          component={BookingScreen}
          options={{ title: 'Booking request' }}
        />
        <Stack.Screen
          name="Pay"
          component={PayScreen}
          options={{ title: 'Pay' }}
        />
        <Stack.Screen
          name="Blog"
          component={BlogScreen}
          options={{ title: 'Blog' }}
        />
        <Stack.Screen
          name="BlogArticle"
          component={BlogArticleScreen}
          options={{ title: 'Article' }}
        />
        <Stack.Screen
          name="Travelers"
          component={TravelersScreen}
          options={{ title: 'Travelers' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Login' }}
        />
        <Stack.Screen
          name="DataPrivacy"
          component={DataPrivacyScreen}
          options={{ title: 'Data & privacy' }}
        />
        <Stack.Screen
          name="PaySuccess"
          component={PaySuccessScreen}
          options={{ title: 'Payment successful' }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ title: 'Search packages' }}
        />
        <Stack.Screen
          name="Compare"
          component={CompareScreen}
          options={{ title: 'Compare packages' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationCenter}
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen
          name="Planner"
          component={PlannerScreen}
          options={{ title: 'Trip planner' }}
        />
        <Stack.Screen
          name="TripDetail"
          component={TripDetailScreen}
          options={{ title: 'Trip details' }}
        />
        <Stack.Screen
          name="BlogLibrary"
          component={BlogLibraryScreen}
          options={{ title: 'My library' }}
        />
        <Stack.Screen
          name="BlogVideoGuides"
          component={BlogVideoGuidesScreen}
          options={{ title: 'Video guides' }}
        />
        <Stack.Screen
          name="DestinationHubs"
          component={DestinationHubsScreen}
          options={{ title: 'Destination guides' }}
        />
        <Stack.Screen
          name="DestinationHub"
          component={DestinationHubScreen}
          options={{ title: 'Destination guide' }}
        />
        <Stack.Screen
          name="TripKit"
          component={TripKitScreen}
          options={{ title: 'Trip kit' }}
        />
        <Stack.Screen
          name="OfflineDiagnostics"
          component={OfflineDiagnosticsScreen}
          options={{ title: 'Offline & diagnostics' }}
        />
        <Stack.Screen
          name="Trust"
          component={TrustRoute}
          options={{ title: 'Trust & safety' }}
        />
        <Stack.Screen
          name="Offers"
          component={OffersRoute}
          options={{ title: 'Offers & more' }}
        />
        <Stack.Screen
          name="Referral"
          component={ReferralScreen}
          options={{ title: 'Refer & invite' }}
        />
        <Stack.Screen
          name="Invite"
          component={InviteScreen}
          options={{ title: 'Invite' }}
        />
        <Stack.Screen
          name="ReportIssue"
          component={ReportIssueRoute}
          options={{ title: 'Report wrong info' }}
        />
        <Stack.Screen
          name="GroupEnquiry"
          component={GroupEnquiryRoute}
          options={{ title: 'Group booking' }}
        />
        <Stack.Screen
          name="GiftTrip"
          component={GiftTripRoute}
          options={{ title: 'Gift a trip' }}
        />
        <Stack.Screen
          name="Diagnostics"
          component={DiagnosticsScreen}
          options={{ title: 'Release health' }}
        />
      </Stack.Navigator>
    </View>
  );
}

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  // v1.1 item 121: honour the system reduced-motion setting — no
  // animation at all when it is on, 180ms (within 150–220ms) otherwise.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // v2.0.2 launch screen: fade out only when motion is allowed, and
  // only after the first render is ready + the minimum display. The
  // timeout is a one-shot hide, not a gate on any network fetch: the
  // catalogue loads in the background after first paint, so a slow
  // connection can never trap the user on the splash screen.
  useEffect(() => {
    SplashScreen.setOptions({
      duration: reduceMotion ? 0 : 300,
      fade: !reduceMotion,
    });
    const remaining = MIN_SPLASH_MS - (Date.now() - APP_START_MS);
    const timer = setTimeout(
      () => {
        void SplashScreen.hideAsync().catch(() => undefined);
      },
      Math.max(0, remaining),
    );
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // v1.3 notifications: listeners + badge sync + tapped-notification
  // deep links (real routes only). Permission is never auto-prompted
  // here — the centre's enable button requests it explicitly.
  useEffect(() => {
    registerNotificationNavigation((link) => {
      if (!navigationRef.isReady()) return;
      if (link.screen === 'PackageDetail' && link.slug) {
        navigationRef.navigate('PackageDetail', { slug: link.slug });
      } else if (link.screen === 'Trips') {
        navigationRef.navigate('Tabs', { screen: 'Trips' });
      } else if (link.screen === 'Notifications') {
        navigationRef.navigate('Notifications');
      }
    });
    return initNotifications();
  }, []);

  // v2 item 152: retry queued (offline) enquiries whenever the app
  // returns to the foreground. AppState trigger only — no NetInfo is
  // installed, so this is never claimed as connectivity-based. Only a
  // resolved submit removes an item from the queue.
  useEffect(() => {
    const unsubscribe = registerForegroundFlush(() => {
      void flushEnquiryQueue((item) =>
        submitEnquiry(item.input, item.formRenderedAt),
      );
    });
    return unsubscribe;
  }, []);

  // Tab-bar glyphs (v1.1 item 1): load the Ionicons font. The navigator
  // renders regardless, so a font failure can never blank the app.
  Font.useFonts({ ...Ionicons.font });

  return (
    <SettingsProvider>
      <SafeAreaProvider>
        <CatalogProvider>
          <NavigationContainer ref={navigationRef}>
            <LaunchGate reduceMotion={reduceMotion} />
          </NavigationContainer>
        </CatalogProvider>
      </SafeAreaProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  gateWrap: { flex: 1 },
  nudge: { paddingHorizontal: 16, paddingVertical: 12 },
  nudgeText: { fontSize: 14, lineHeight: 20 },
  nudgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  nudgeButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#127C82',
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  nudgePrimary: { backgroundColor: '#127C82', borderColor: '#127C82' },
  nudgeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
