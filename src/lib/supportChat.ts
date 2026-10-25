/**
 * Instant support chat client (v2.0.2).
 *
 * The chat API itself is built by the site builder in parallel — this
 * module only implements the fixed contract, it does not invent an API:
 *
 *   POST {SITE_BASE}/api/chat  body { message: string }
 *   -> { reply: string, actions?: Action[], suggestions?: string[] }
 *   Action = { type: 'package'|'enquiry'|'booking'|'call'|'whatsapp',
 *              label: string, slug?: string, url?: string, text?: string }
 *
 * SITE_BASE is the same public website base the catalogue uses
 * (src/lib/api.ts). No secrets live here. A reply with no usable text
 * is treated as a failed response so the screen shows its honest error
 * state (with Call/WhatsApp fallback) instead of an empty bubble.
 * No message is ever sent except when the user taps Send (or a
 * suggestion chip / Home prompt, which is the same user action).
 */
import { ApiError, SITE_BASE } from './api';

export type ChatActionType =
  | 'package'
  | 'enquiry'
  | 'booking'
  | 'call'
  | 'whatsapp';

export interface ChatAction {
  type: ChatActionType;
  label: string;
  slug?: string;
  url?: string;
  text?: string;
}

export interface ChatReply {
  reply: string;
  actions: ChatAction[];
  suggestions: string[];
}

const CHAT_TIMEOUT_MS = 20000;
const ACTION_TYPES: ChatActionType[] = [
  'package',
  'enquiry',
  'booking',
  'call',
  'whatsapp',
];

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAction(raw: unknown): ChatAction | null {
  if (!isRecord(raw)) return null;
  const type = asString(raw.type);
  if (!ACTION_TYPES.includes(type as ChatActionType)) return null;
  const label = asString(raw.label).trim();
  if (label === '') return null;
  const action: ChatAction = { type: type as ChatActionType, label };
  const slug = asString(raw.slug).trim();
  if (slug !== '') action.slug = slug;
  const url = asString(raw.url).trim();
  if (url !== '') action.url = url;
  const text = asString(raw.text).trim();
  if (text !== '') action.text = text;
  return action;
}

/**
 * Send one user message to the site chat API and return the parsed
 * reply. Throws ApiError with a user-safe message on timeout, network
 * failure, non-OK status, or a malformed reply — the caller renders the
 * honest error state, never a canned answer presented as a reply.
 */
export async function postChatMessage(message: string): Promise<ChatReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${SITE_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(
          'The chat request timed out. Please check your connection and try again.',
        );
      }
      throw new ApiError(
        'Could not reach the support chat. Please check your connection and try again.',
      );
    }
    if (!res.ok) {
      if (res.status === 429) {
        throw new ApiError(
          'Too many chat requests right now. Please try again shortly.',
          res.status,
        );
      }
      throw new ApiError(
        'The support chat is unavailable right now. Please try again or contact the team directly.',
        res.status,
      );
    }
    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      throw new ApiError(
        'The support chat returned an unexpected response. Please try again.',
      );
    }
    if (!isRecord(data)) {
      throw new ApiError(
        'The support chat returned an unexpected response. Please try again.',
      );
    }
    const reply = asString(data.reply).trim();
    if (reply === '') {
      throw new ApiError(
        'The support chat returned an empty reply. Please try again.',
      );
    }
    const actions: ChatAction[] = Array.isArray(data.actions)
      ? data.actions
          .map(parseAction)
          .filter((a): a is ChatAction => a !== null)
      : [];
    const suggestions: string[] = Array.isArray(data.suggestions)
      ? data.suggestions
          .map((s) => asString(s).trim())
          .filter((s) => s !== '')
      : [];
    return { reply, actions, suggestions };
  } finally {
    clearTimeout(timer);
  }
}
