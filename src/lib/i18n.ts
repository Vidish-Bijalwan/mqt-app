/**
 * UI-chrome dictionaries (v1.2). English + Hindi for core UI strings only:
 * tabs, common actions, settings, chat chrome, and error states.
 * Package and blog CONTENT stays exactly as served — it is never
 * translated here. Keys not present in Hindi fall back to English.
 * Coverage is honest: only the keys below are translated; every other
 * string in the app remains English until a later batch extends this.
 */

export type Language = 'en' | 'hi';

export const I18N_KEYS = [
  'tabHome',
  'tabPackages',
  'tabTrips',
  'tabChat',
  'tabAccount',
  'call',
  'whatsapp',
  'send',
  'cancel',
  'retry',
  'loading',
  'save',
  'delete',
  'backToHome',
  'settings',
  'profile',
  'travelers',
  'login',
  'dataPrivacy',
  'chatTitle',
  'chatEmpty',
  'chatFaq',
  'errorGeneric',
  'errorNetwork',
] as const;

export type I18nKey = (typeof I18N_KEYS)[number];

type Dict = Record<I18nKey, string>;

const EN: Dict = {
  tabHome: 'Home',
  tabPackages: 'Packages',
  tabTrips: 'Trips',
  tabChat: 'Chat',
  tabAccount: 'Account',
  call: 'Call',
  whatsapp: 'WhatsApp',
  send: 'Send',
  cancel: 'Cancel',
  retry: 'Try again',
  loading: 'Loading…',
  save: 'Save',
  delete: 'Delete',
  backToHome: 'Back to Home',
  settings: 'Settings',
  profile: 'Profile',
  travelers: 'Travelers',
  login: 'Login',
  dataPrivacy: 'Data & privacy',
  chatTitle: 'Chat with the team',
  chatEmpty:
    'Messages sent here go to the team as enquiries. Replies come via WhatsApp or a callback — for instant answers, use MQT Support instant chat via the banner above.',
  chatFaq: 'Frequently asked questions',
  errorGeneric: 'Something went wrong. Please try again.',
  errorNetwork:
    'Could not reach the server. Please check your connection and try again.',
};

const HI: Dict = {
  tabHome: 'होम',
  tabPackages: 'पैकेज',
  tabTrips: 'यात्राएँ',
  tabChat: 'चैट',
  tabAccount: 'खाता',
  call: 'कॉल करें',
  whatsapp: 'व्हाट्सऐप',
  send: 'भेजें',
  cancel: 'रद्द करें',
  retry: 'फिर से कोशिश करें',
  loading: 'लोड हो रहा है…',
  save: 'सहेजें',
  delete: 'हटाएँ',
  backToHome: 'होम पर वापस जाएँ',
  settings: 'सेटिंग्स',
  profile: 'प्रोफ़ाइल',
  travelers: 'यात्री',
  login: 'लॉगिन',
  dataPrivacy: 'डेटा और गोपनीयता',
  chatTitle: 'टीम से चैट करें',
  chatEmpty:
    'यहाँ भेजे गए संदेश टीम तक पूछताछ के रूप में पहुँचते हैं। जवाब व्हाट्सऐप या कॉलबैक से मिलेगा — तुरंत जवाब के लिए ऊपर दिए गए बैनर से MQT Support इंस्टेंट चैट का उपयोग करें।',
  chatFaq: 'अक्सर पूछे जाने वाले प्रश्न',
  errorGeneric: 'कुछ गलत हो गया। कृपया फिर से कोशिश करें।',
  errorNetwork:
    'सर्वर से संपर्क नहीं हो सका। कृपया अपना कनेक्शन जाँचें और फिर से कोशिश करें।',
};

export const DICTIONARIES: Record<Language, Dict> = { en: EN, hi: HI };

/** Translate one UI-chrome key; falls back to English, then the key. */
export function translate(language: Language, key: I18nKey): string {
  return DICTIONARIES[language][key] ?? EN[key] ?? key;
}
