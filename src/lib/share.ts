/**
 * Sharing helpers (v2, items 191/194/195).
 *
 * HONESTY RULES, DO NOT WEAKEN:
 * - Package links use the verified site pattern
 *   https://www.myquicktrippers.com/packages/<slug> (verified from the
 *   live sitemap; see src/lib/booking.ts packageSiteUrl).
 * - Share text never invents a price, rating, discount, or photo.
 *   A package's real price is included ONLY when getPriceInfo() says
 *   it has one, and then exactly as getPriceInfo() renders it.
 * - Referral links carry no benefit: the referral benefit is OFF
 *   (business has not defined one). The link only records the referrer
 *   locally; no value, percentage, or coupon is ever promised.
 */
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SITE_BASE } from './api';
import { packageSiteUrl } from './booking';
import { getPriceInfo } from './price';
import type { Package } from '../data/packages';

/** App invite link: the public website (the app is not on a store yet,
 *  so no store link is invented). */
export const APP_INVITE_URL = `${SITE_BASE}/`;

export function referralLink(referrerCode: string): string {
  const code = referrerCode.trim();
  return code === '' ? APP_INVITE_URL : `${APP_INVITE_URL}?ref=${encodeURIComponent(code)}`;
}

/** Device-local referral record. Stored only on this device. */
export const REFERRAL_STORAGE_KEY = '@mqt/referral';

export interface ReferralRecord {
  /** The code this device shares (derived from the device, not a person). */
  code: string;
  /** ISO timestamp the code was first created on this device. */
  createdAt: string;
  /** Benefit: always empty — no business-approved benefit exists. */
  benefit: '';
}

export async function loadReferral(): Promise<ReferralRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ReferralRecord).code !== 'string' ||
      typeof (parsed as ReferralRecord).createdAt !== 'string'
    ) {
      return null;
    }
    return {
      code: (parsed as ReferralRecord).code,
      createdAt: (parsed as ReferralRecord).createdAt,
      benefit: '',
    };
  } catch {
    return null;
  }
}

/** Create (or return the existing) referral record for this device. */
export async function getOrCreateReferral(): Promise<ReferralRecord> {
  const existing = await loadReferral();
  if (existing !== null) return existing;
  const record: ReferralRecord = {
    code: `MQT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    benefit: '',
  };
  try {
    await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort: the in-memory record is still shareable.
  }
  return record;
}

/** Share a package as a rich card: title + real price (when it exists)
 *  + verified site link. No image is attached as a "photo card" — the
 *  link unfurls the site's own photo. */
export async function sharePackage(pkg: Package): Promise<void> {
  const price = getPriceInfo(pkg);
  const lines = [`${pkg.title} — My Quick Trippers`];
  if (price.hasPrice) lines.push(`Price: ${price.display}`);
  lines.push(packageSiteUrl(pkg.slug));
  await Share.share({ message: lines.join('\n') });
}

/** Share a trip plan (a saved trip / enquiry) as text + link. The link
 *  is the package page when a slug exists, else the site home page.
 *  No dates, prices, or booking status are claimed beyond what the
 *  caller passes in as plain text. */
export async function shareTripPlan(args: {
  packageName: string;
  slug?: string;
  note?: string;
}): Promise<void> {
  const lines = [`My trip plan: ${args.packageName} — My Quick Trippers`];
  if (args.note !== undefined && args.note.trim() !== '') {
    lines.push(args.note.trim());
  }
  lines.push(
    args.slug !== undefined && args.slug !== ''
      ? packageSiteUrl(args.slug)
      : SITE_BASE,
  );
  await Share.share({ message: lines.join('\n') });
}

/** Share the app invite link via the system Share sheet. QR rendering
 *  is NOT included: it needs react-native-qrcode-svg, which is not
 *  installed (see qa/v2-routes-trust-growth.md). Never fake a QR image. */
export async function shareAppInvite(code: string): Promise<void> {
  await Share.share({
    message: `Plan your next trip with My Quick Trippers: ${referralLink(code)}`,
  });
}
