/** Shared branding + contact constants for the MQT app. */

export const BRAND = {
  name: 'My Quick Trippers',
  primary: '#127C82',
  primaryDark: '#0E6368',
  text: '#1A1A1A',
  muted: '#666666',
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
  placeholderBackground: '#E8E8E8',
  placeholderText: '#888888',
  border: '#E0E0E0',
  estimatedBackground: '#FFF4E0',
  estimatedText: '#8A5A00',
} as const;

/** Real business contact — same numbers as myquicktrippers.com. */
export const CONTACT = {
  phoneDisplay: '+91 81711 58569',
  telUrl: 'tel:+918171158569',
  whatsappUrl: 'https://wa.me/918171158569',
} as const;

/**
 * App version shown in the Account tab. Bumped by the parent on release
 * (v1.1.0 next) — do not bump it in feature work.
 */
export const APP_VERSION = '2.0.0';

export function whatsappEnquiryUrl(packageName: string): string {
  const text = `Hi My Quick Trippers! I would like to enquire about the "${packageName}" package. Please share details and the final quote.`;
  return `${CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`;
}
