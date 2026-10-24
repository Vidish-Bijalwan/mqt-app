import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BRAND } from './src/constants';
import type { RootStackParamList } from './src/navigation/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { PackageDetailScreen } from './src/screens/PackageDetailScreen';
import { EnquiryScreen } from './src/screens/EnquiryScreen';
import { PayScreen } from './src/screens/PayScreen';
import { BlogScreen } from './src/screens/BlogScreen';
import { PaySuccessScreen } from './src/screens/PaySuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: BRAND.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PackageDetail"
          component={PackageDetailScreen}
          options={{ title: 'Package details' }}
        />
        <Stack.Screen
          name="Enquiry"
          component={EnquiryScreen}
          options={{ title: 'Enquire' }}
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
          name="PaySuccess"
          component={PaySuccessScreen}
          options={{ title: 'Payment successful' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
