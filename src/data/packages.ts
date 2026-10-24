/**
 * Package catalogue owned by the app (copied from the website data feed).
 * Source files: src/data/packages.json (652 public packages, trimmed fields)
 * and src/data/priceOverrides.json (709 entries).
 *
 * NEVER render `mrp` / `dealPrice` from here directly — always go through
 * `getPriceInfo()` in ../lib/price.ts (see that file for the rules).
 */
import packagesJson from './packages.json';

export interface Package {
  slug: string;
  title: string;
  category: string;
  image: string;
  duration: string;
  route: string;
  description: string;
  mrp: string;
  dealPrice: string;
}

export const packages = packagesJson as Package[];

/** The 13 categories present in the data, in display order. */
export const CATEGORIES: string[] = Array.from(
  new Set(packages.map((p) => p.category)),
);

/** Site-absolute image URL. The app never invents photos. */
export const SITE_BASE_URL = 'https://www.myquicktrippers.com';

export function packageImageUrl(pkg: Package): string | null {
  if (!pkg.image) return null;
  if (pkg.image.startsWith('http://') || pkg.image.startsWith('https://')) {
    return pkg.image;
  }
  return `${SITE_BASE_URL}${pkg.image}`;
}
