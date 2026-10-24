import { Linking } from 'react-native';

/** Real business contact — same numbers as myquicktrippers.com. */
export const CONTACT_PHONE = '+918171158569';
export const CONTACT_PHONE_DISPLAY = '+91 81711 58569';

/** Open the phone dialler for the My Quick Trippers team. */
export function callAction(): Promise<void> {
  return Linking.openURL(`tel:${CONTACT_PHONE}`);
}

/** WhatsApp deep link with a prefilled message. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/918171158569?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp with a prefilled message. */
export function whatsappAction(message: string): Promise<void> {
  return Linking.openURL(whatsappUrl(message));
}

/** Standard enquiry message for a package (used by detail + enquiry screens). */
export function enquiryMessage(packageName: string): string {
  return (
    `Hi My Quick Trippers! I would like to enquire about the ` +
    `"${packageName}" package. Please share details and the final quote.`
  );
}
