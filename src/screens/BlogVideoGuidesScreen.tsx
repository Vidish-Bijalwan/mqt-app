/**
 * Video guides (v2, item 98) — honest empty state.
 *
 * There is no MQT video feed, video route, or video asset in the repo
 * or the blog feed today (verified by search over src/ and assets/),
 * so this screen ships an empty state and nothing else. Stock footage
 * is never presented as My Quick Trippers videos. When the team
 * publishes real videos, listVideoGuides() in lib/reading.ts is where
 * they land — this screen then renders them instead of this state.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { VIDEO_GUIDES_EMPTY_MESSAGE } from '../lib/reading';

export function BlogVideoGuidesScreen() {
  const navigation = useNavigation() as unknown as {
    goBack: () => void;
  };
  const { colors, fs } = useSettings();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text, fontSize: fs(FONT.title) }]}>
          Video guides
        </Text>
        <Text style={[styles.text, { color: colors.muted, fontSize: fs(FONT.body) }]}>
          {VIDEO_GUIDES_EMPTY_MESSAGE}
        </Text>
        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to blog</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', padding: SPACING.xl },
  title: { fontWeight: WEIGHT.bold, textAlign: 'center' },
  text: { marginTop: SPACING.md, textAlign: 'center', lineHeight: 22 },
  button: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  primaryButton: { backgroundColor: '#127C82' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: WEIGHT.bold },
});
