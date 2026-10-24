/**
 * Price logic ported EXACTLY from the myquicktrippers.com website
 * (`getPriceInfo()` in `src/utils/price`, which reads `priceOverrides.json` first).
 *
 * RULES (do not "improve" these without checking the website logic):
 * - NEVER render a package's raw `dealPrice` / `mrp` directly. Always go
 *   through `getPriceInfo()` and render `display` / `crossed` / `save`.
 * - When `hasPrice` is false, the UI must show "Pricing on request" —
 *   never a made-up number.
 * - Overrides (priceOverrides.json, keyed by slug) win over the raw
 *   package fields. `estimated` is true when the applied override has
 *   `estimated: true`.
 */
import priceOverridesJson from '../data/priceOverrides.json';
import type { Package } from '../data/packages';

export const MINIMUM_PUBLIC_PRICE = 10000;

/** Domestic-pricing exceptions: these are NOT priced as International. */
const DOMESTIC_PRICING_EXCEPTION = /adi kailash|chennai mahabalipuram/i;

/** Sentinel values that mean "no real price" — force hasPrice=false. */
const SENTINEL_VALUES = [2, 24750];

export interface PriceOverride {
  mrp?: string;
  dealPrice?: string;
  originalMrp?: string;
  originalDealPrice?: string;
  estimated?: boolean;
}

const priceOverrides = priceOverridesJson as Record<string, PriceOverride>;

/** Strip everything except digits and parse. Empty / garbage => 0. */
export function parseINR(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (digits === '') return 0;
  const parsed = parseInt(digits, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatINR(value: number): string {
  return `\u20B9${value.toLocaleString('en-IN')}`;
}

export interface PriceInfo {
  /** Final deal price (number) — use as Pay prefill amount when hasPrice. */
  deal: number;
  /** Final MRP (number). */
  mrp: number;
  /** False => UI must show "Pricing on request". */
  hasPrice: boolean;
  /** en-IN formatted deal, or '' when hasPrice is false. */
  display: string;
  /** en-IN formatted MRP, only when mrp > deal; otherwise ''. */
  crossed: string;
  /** en-IN formatted saving (mrp - deal), only when mrp > deal; else ''. */
  save: string;
  /** True when the applied override has estimated: true. */
  estimated: boolean;
  /** True when the package is priced via the International path. */
  isInternational: boolean;
}

export function isInternationalPricing(pkg: Package): boolean {
  if (pkg.category !== 'International') return false;
  // Domestic-for-pricing exceptions, matched against title or slug.
  if (DOMESTIC_PRICING_EXCEPTION.test(pkg.title)) return false;
  if (DOMESTIC_PRICING_EXCEPTION.test(pkg.slug)) return false;
  return true;
}

export function getPriceInfo(pkg: Package): PriceInfo {
  const override: PriceOverride | undefined = priceOverrides[pkg.slug];

  const rawMrp = parseINR(override?.mrp ?? pkg.mrp);
  const rawDeal = parseINR(override?.dealPrice ?? pkg.dealPrice);
  const originalMrp = parseINR(override?.originalMrp);
  const originalDeal = parseINR(override?.originalDealPrice);

  const isFallback = [rawMrp, rawDeal, originalMrp, originalDeal].some((v) =>
    SENTINEL_VALUES.includes(v),
  );

  const international = isInternationalPricing(pkg);

  let mrpValue: number;
  let dealValue: number;

  if (international) {
    // Originals are usable only when they look like a sane pre-uplift price:
    // deal >= MINIMUM/2.5, mrp >= deal, and deal >= 50% of mrp.
    const originalsUsable =
      originalDeal >= MINIMUM_PUBLIC_PRICE / 2.5 &&
      originalMrp >= originalDeal &&
      originalDeal >= originalMrp * 0.5;
    let baseMrp: number;
    let baseDeal: number;
    if (originalsUsable) {
      baseMrp = originalMrp;
      baseDeal = originalDeal;
    } else {
      // Fall back to raw values de-uplifted by 1.5 before the 2.5x uplift.
      baseMrp = rawMrp / 1.5;
      baseDeal = rawDeal / 1.5;
    }
    mrpValue = Math.round(baseMrp * 2.5);
    dealValue = Math.round(baseDeal * 2.5);
  } else {
    // Domestic: override-first raw values as-is.
    mrpValue = rawMrp;
    dealValue = rawDeal;
  }

  const deal = dealValue > 0 ? dealValue : mrpValue;
  const mrp = mrpValue;
  const hasPrice = deal >= MINIMUM_PUBLIC_PRICE && !isFallback;

  return {
    deal,
    mrp,
    hasPrice,
    display: hasPrice ? formatINR(deal) : '',
    crossed: hasPrice && mrp > deal ? formatINR(mrp) : '',
    save: hasPrice && mrp > deal ? formatINR(mrp - deal) : '',
    estimated: override?.estimated === true,
    isInternational: international,
  };
}
