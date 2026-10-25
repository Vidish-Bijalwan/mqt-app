/**
 * Instant support chat (v2.0.2) — the NEW chat screen, separate from the
 * existing Chat tab composer (ChatScreen.tsx), which is untouched.
 *
 * PERSONA, HONESTLY: the header reads "MQT Support" and the greeting
 * introduces it as from Amit Sajwan's team — it never claims to be Amit
 * himself, never uses a fake human employee name, and never fakes
 * typing from Amit. The typing indicator below renders ONLY while a
 * real POST /api/chat request is in flight (state `sending`); there is
 * no simulated typing delay anywhere in this file.
 *
 * HUMAN HANDOFF (senior-forwarding story, implemented, not claimed):
 * the assistant answers instantly via the site chat API; anything that
 * needs a human goes to Amit through the two real actions at the foot
 * of this screen — "Send to Amit on WhatsApp" (opens wa.me with a
 * prefilled summary of this conversation) and "Save as enquiry"
 * (submits via the EXISTING submitEnquiry path into the Leads table,
 * but ONLY after the user types name + phone here and taps Confirm —
 * PII is never auto-submitted and never submitted without confirmation).
 *
 * ACTIONS (fixed API contract, wired BY TYPE, never by the presence
 * of a url field): package -> PackageDetail for that slug; enquiry ->
 * Enquiry flow; booking -> the existing Booking REQUEST flow even if
 * the action happens to carry url "/pay" (never navigate to /pay for
 * a booking action — the booking request is the correct destination);
 * call -> team number dialler; whatsapp -> the wa.me link with the
 * prefilled text (the team number, via whatsappAction). An unverified package slug
 * (not in the loaded catalogue, once loading has settled) is not
 * rendered as a button at all, so a tap can never land on a false
 * "could not be found" detail. Suggestions render as tappable
 * quick-reply chips that send that exact text.
 *
 * ERROR STATE: when the API is unreachable, an error bubble renders
 * with Call / WhatsApp fallback buttons and a Retry that resends the
 * last user message — never a canned answer presented as a reply.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScrollViewInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FONT, RADII, SPACING, TOUCH_MIN, WEIGHT } from '../theme/tokens';
import { useSettings } from '../context/SettingsContext';
import { useCatalog } from '../lib/catalog';
import { ApiError, enquiryValidationError, submitEnquiry } from '../lib/api';
import type { ChatAction } from '../lib/supportChat';
import { postChatMessage } from '../lib/supportChat';
import {
  callAction,
  CONTACT_PHONE_DISPLAY,
  whatsappAction,
} from '../lib/contact';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportChat'>;

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'error';
  text: string;
  actions?: ChatAction[];
  suggestions?: string[];
}

const GREETING =
  "Hi! I'm MQT Support, from Amit's team at My Quick Trippers. " +
  'Ask me about packages, prices, or how booking works — I answer ' +
  'instantly, and anything that needs a human I forward to Amit.';

let nextId = 1;

function whatsappSummary(messages: ChatMessage[]): string {
  const turns = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Me' : 'MQT Support'}: ${m.text}`)
    .join('\n');
  return (
    'Hi My Quick Trippers! I was chatting in the app and need help ' +
    'from Amit:\n' +
    (turns !== '' ? turns : 'No messages yet.')
  );
}

export function SupportChatScreen({ route, navigation }: Props) {
  const { colors, fs } = useSettings();
  const catalog = useCatalog();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: 'assistant', text: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryNote, setEnquiryNote] = useState<string | null>(null);
  const [enquiryBusy, setEnquiryBusy] = useState(false);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const initialSentRef = useRef(false);

  const scrollToEnd = () => {
    scrollRef.current?.scrollToEnd({ animated: false });
  };

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed === '' || sending) return;
    const userMsg: ChatMessage = { id: nextId++, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLastUserMessage(trimmed);
    setInput('');
    setSending(true);
    try {
      const reply = await postChatMessage(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          role: 'assistant',
          text: reply.reply,
          actions: reply.actions,
          suggestions: reply.suggestions,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not reach the support chat. Please try again.';
      setMessages((prev) => [
        ...prev,
        { id: nextId++, role: 'error', text: message },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Home prompt chips navigate here with initialMessage; sending it is
  // the user's own tap on that prompt, sent exactly once.
  useEffect(() => {
    const initial = route.params?.initialMessage;
    if (initial !== undefined && initial !== '' && !initialSentRef.current) {
      initialSentRef.current = true;
      void send(initial);
    }
    // Only on mount: resending on every param change would duplicate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function packageTitle(slug: string): string {
    return (
      catalog.packages.find((p) => p.slug === slug)?.title ?? slug
    );
  }

  function visibleAction(action: ChatAction): boolean {
    if (action.type === 'package') {
      // Verified slug only: hide while the catalogue is still loading
      // is NOT applied — the detail screen's own loading gate covers
      // that case; hide only once loading has settled and the slug is
      // genuinely absent from the catalogue.
      if (action.slug === undefined) return false;
      if (catalog.loading) return true;
      return catalog.packages.some((p) => p.slug === action.slug);
    }
    if (action.type === 'booking') return action.slug !== undefined;
    return true;
  }

  // Routing is by action.type ONLY. A booking action's url (e.g.
  // "/pay") is deliberately ignored — it must not divert the booking
  // request flow to a payment screen. Likewise a whatsapp action
  // always opens the team's wa.me link with its prefilled text, never
  // an arbitrary url from the payload.
  function runAction(action: ChatAction): void {
    if (action.type === 'package' && action.slug !== undefined) {
      navigation.navigate('PackageDetail', { slug: action.slug });
    } else if (action.type === 'enquiry') {
      navigation.navigate('Enquiry', {
        slug: action.slug ?? '',
        packageName:
          action.slug !== undefined
            ? packageTitle(action.slug)
            : action.label,
      });
    } else if (action.type === 'booking' && action.slug !== undefined) {
      navigation.navigate('Booking', {
        slug: action.slug,
        packageName: packageTitle(action.slug),
      });
    } else if (action.type === 'call') {
      void callAction();
    } else if (action.type === 'whatsapp') {
      void whatsappAction(action.text ?? action.label);
    }
  }

  async function confirmEnquiry(): Promise<void> {
    const input = {
      name: enquiryName,
      phone: enquiryPhone,
      message: whatsappSummary(messages),
    };
    const validation = enquiryValidationError(input);
    if (validation !== null) {
      setEnquiryNote(validation);
      return;
    }
    setEnquiryBusy(true);
    setEnquiryNote(null);
    try {
      const result = await submitEnquiry(input, Date.now());
      setEnquiryNote(
        `Saved as enquiry — ref ${result.ref}. The team will call you back.`,
      );
      setShowEnquiryForm(false);
    } catch (err) {
      setEnquiryNote(
        err instanceof ApiError
          ? err.message
          : 'Could not save the enquiry. Please try again or use WhatsApp.',
      );
    } finally {
      setEnquiryBusy(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right', 'bottom']}>
      <View
        style={[styles.persona, { backgroundColor: colors.primary }]}>
        <Text style={[styles.personaName, { fontSize: fs(FONT.heading) }]}>
          MQT Support
        </Text>
        <Text style={[styles.personaSub, { fontSize: fs(FONT.meta) }]}>
          From Amit&apos;s team at My Quick Trippers · replies instantly
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        onContentSizeChange={scrollToEnd}>
        {messages.map((msg) => (
          <View key={msg.id}>
            <View
              style={[
                styles.bubble,
                msg.role === 'user'
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : msg.role === 'error'
                    ? [
                        styles.errorBubble,
                        {
                          backgroundColor: colors.errorBg,
                          borderColor: colors.errorText,
                        },
                      ]
                    : [
                        styles.assistantBubble,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ],
              ]}>
              <Text
                style={[
                  styles.bubbleText,
                  {
                    fontSize: fs(FONT.body),
                    color:
                      msg.role === 'user'
                        ? colors.white
                        : msg.role === 'error'
                          ? colors.errorText
                          : colors.text,
                  },
                ]}>
                {msg.text}
              </Text>
              {msg.role === 'error' ? (
                <View style={styles.fallbackRow}>
                  <Pressable
                    style={[styles.fallbackButton, { borderColor: colors.primary }]}
                    onPress={() => void callAction()}>
                    <Text
                      style={[
                        styles.fallbackButtonText,
                        { color: colors.primary, fontSize: fs(FONT.body) },
                      ]}>
                      Call {CONTACT_PHONE_DISPLAY}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.fallbackButton, { borderColor: colors.primary }]}
                    onPress={() =>
                      void whatsappAction(whatsappSummary(messages))
                    }>
                    <Text
                      style={[
                        styles.fallbackButtonText,
                        { color: colors.primary, fontSize: fs(FONT.body) },
                      ]}>
                      WhatsApp the team
                    </Text>
                  </Pressable>
                  {lastUserMessage !== null ? (
                    <Pressable
                      style={[styles.fallbackButton, { borderColor: colors.primary }]}
                      onPress={() => void send(lastUserMessage)}>
                      <Text
                        style={[
                          styles.fallbackButtonText,
                          { color: colors.primary, fontSize: fs(FONT.body) },
                        ]}>
                        Retry
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
            {msg.actions !== undefined && msg.actions.length > 0 ? (
              <View style={styles.actionRow}>
                {msg.actions.filter(visibleAction).map((action, i) => (
                  <Pressable
                    key={`${msg.id}-${i}`}
                    style={[
                      styles.actionButton,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.card,
                      },
                    ]}
                    onPress={() => runAction(action)}>
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.primary, fontSize: fs(FONT.meta) },
                      ]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {msg.suggestions !== undefined && msg.suggestions.length > 0 ? (
              <View style={styles.chipRow}>
                {msg.suggestions.map((suggestion, i) => (
                  <Pressable
                    key={`${msg.id}-s-${i}`}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    onPress={() => void send(suggestion)}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.text, fontSize: fs(FONT.meta) },
                      ]}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {sending ? (
          <View
            style={[
              styles.bubble,
              styles.assistantBubble,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <Text
              style={[
                styles.bubbleText,
                { fontSize: fs(FONT.body), color: colors.muted },
              ]}>
              MQT Support is typing…
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[styles.handoff, { borderTopColor: colors.border }]}>
        <Text style={[styles.handoffLabel, { color: colors.muted, fontSize: fs(FONT.meta) }]}>
          Need a human? Forward this chat to Amit:
        </Text>
        <View style={styles.handoffRow}>
          <Pressable
            style={[styles.handoffButton, { backgroundColor: colors.primary }]}
            onPress={() => void whatsappAction(whatsappSummary(messages))}>
            <Text style={[styles.handoffButtonText, { fontSize: fs(FONT.body) }]}>
              Send to Amit on WhatsApp
            </Text>
          </Pressable>
          <Pressable
            style={[styles.handoffButton, { borderColor: colors.primary, borderWidth: 1 }]}
            onPress={() => setShowEnquiryForm((v) => !v)}>
            <Text
              style={[
                styles.handoffButtonText,
                { color: colors.primary, fontSize: fs(FONT.body) },
              ]}>
              Save as enquiry
            </Text>
          </Pressable>
        </View>
        {showEnquiryForm ? (
          <View style={styles.enquiryForm}>
            <Text style={[styles.enquiryLabel, { color: colors.text, fontSize: fs(FONT.body) }]}>
              Confirm your name and phone — nothing is sent until you tap
              Confirm below.
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                },
              ]}
              value={enquiryName}
              onChangeText={setEnquiryName}
              placeholder="Your full name"
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="words"
            />
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                },
              ]}
              value={enquiryPhone}
              onChangeText={setEnquiryPhone}
              placeholder="Mobile number"
              placeholderTextColor={colors.placeholderText}
              keyboardType="phone-pad"
            />
            <Pressable
              style={[styles.handoffButton, { backgroundColor: colors.primary }]}
              onPress={() => void confirmEnquiry()}
              disabled={enquiryBusy}>
              <Text style={[styles.handoffButtonText, { fontSize: fs(FONT.body) }]}>
                {enquiryBusy ? 'Saving…' : 'Confirm — save as enquiry'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {enquiryNote !== null ? (
          <Text style={[styles.enquiryNote, { color: colors.text, fontSize: fs(FONT.body) }]}>
            {enquiryNote}
          </Text>
        ) : null}
      </View>

      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <TextInput
          style={[
            styles.composerInput,
            {
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              color: colors.text,
            },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about packages, prices, booking…"
          placeholderTextColor={colors.placeholderText}
          multiline
          onSubmitEditing={() => void send(input)}
        />
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 },
          ]}
          onPress={() => void send(input)}
          disabled={sending}
          accessibilityLabel="Send message">
          {sending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  persona: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  personaName: { color: '#FFFFFF', fontWeight: WEIGHT.bold },
  personaSub: { color: '#FFFFFF', marginTop: 2, opacity: 0.9 },
  thread: { flex: 1 },
  threadContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
  bubble: {
    borderRadius: RADII.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  userBubble: { alignSelf: 'flex-end' },
  assistantBubble: { borderWidth: 1 },
  errorBubble: { borderWidth: 1 },
  bubbleText: { lineHeight: 22 },
  fallbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  fallbackButton: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  fallbackButtonText: { fontWeight: WEIGHT.bold },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    maxWidth: '85%',
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionButtonText: { fontWeight: WEIGHT.bold },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    maxWidth: '92%',
  },
  chip: {
    borderWidth: 1,
    borderRadius: RADII.chip,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipText: { fontWeight: WEIGHT.medium },
  handoff: { borderTopWidth: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  handoffLabel: { marginBottom: SPACING.sm },
  handoffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  handoffButton: {
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handoffButtonText: { color: '#FFFFFF', fontWeight: WEIGHT.bold },
  enquiryForm: { marginTop: SPACING.md, gap: SPACING.sm },
  enquiryLabel: { lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_MIN,
    fontSize: FONT.body,
  },
  enquiryNote: { marginTop: SPACING.sm, lineHeight: 20 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: TOUCH_MIN,
    maxHeight: 120,
    fontSize: FONT.body,
  },
  sendButton: {
    borderRadius: RADII.button,
    minHeight: TOUCH_MIN,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  sendText: { color: '#FFFFFF', fontWeight: WEIGHT.bold, fontSize: FONT.body },
});
