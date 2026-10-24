import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { PackagesScreen } from '../screens/PackagesScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { SPACING } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Bottom tab bar (v1.2): Home, Packages, Trips, Chat, Account.
 * Chat lands in v1.2 as an enquiry-message tab (see ChatScreen — no live
 * chat, no two-way inbox).
 *
 * HomeScreen is owned by another builder and still typed against the
 * stack params, so it is rendered through a cast adapter here rather
 * than by editing that file. Its navigate('PackageDetail') / navigate
 * ('Blog') calls bubble up to the parent stack, where those screens live.
 */
function HomeTabScreen(
  props: BottomTabScreenProps<TabParamList, 'Home'>,
) {
  const Adapted = HomeScreen as React.ComponentType<
    ComponentProps<typeof HomeScreen>
  >;
  return (
    <Adapted
      {...(props as unknown as ComponentProps<typeof HomeScreen>)}
    />
  );
}

/**
 * Root tab navigator, hosted as the stack's "Tabs" screen in App.tsx.
 * Detail screens (PackageDetail, Enquiry, Pay, PaySuccess, Blog) are
 * pushed above the tabs by the parent stack, so the tab bar stays
 * visible underneath them only when navigating back.
 */
export function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors, t } = useSettings();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        // Explicit height: v7's default uikit bar height (49 + inset) is
        // too short for a 13px label + icon + paddings (needs ~71), so
        // content would crush/overflow. 72 + bottom inset fits icon (28)
        // + label (16) + item padding (10) + bar padding with slack, on
        // every device. No paddingBottom here: v7's own inset padding
        // must survive (it is applied before tabBarStyle in the array).
        tabBarStyle: {
          height: 72 + insets.bottom,
          paddingTop: SPACING.sm,
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<
            string,
            React.ComponentProps<typeof Ionicons>['name']
          > = {
            Home: 'home',
            Packages: 'list',
            Trips: 'airplane',
            Chat: 'chatbubbles',
            Account: 'person',
          };
          return (
            <Ionicons
              name={icons[route.name] ?? 'ellipse'}
              size={size}
              color={color}
            />
          );
        },
      })}>
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{ tabBarLabel: t('tabHome') }}
      />
      <Tab.Screen
        name="Packages"
        component={PackagesScreen}
        options={{ tabBarLabel: t('tabPackages') }}
      />
      <Tab.Screen
        name="Trips"
        component={TripsScreen}
        options={{ tabBarLabel: t('tabTrips') }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: t('tabChat') }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarLabel: t('tabAccount') }}
      />
    </Tab.Navigator>
  );
}
