/**
 * "Build my itinerary" quiz (v2, item 89) — FILTER MATCHING, never AI.
 * The quiz takes a budget cap, an interests query and a preferred-date
 * note, and returns genuinely matching packages from the REAL
 * catalogue through the existing search pipeline (src/lib/search.ts).
 *
 * What each input does, stated plainly in the UI:
 * - Interests: full-text search over title/route/description/category
 *   (same typo-tolerant matching as Search).
 * - Budget: packages whose listed price exceeds the cap are excluded;
 *   packages with NO listed price are also excluded when a budget is
 *   set, because they cannot be verified under that budget — they are
 *   never guessed into range.
 * - Preferred dates: NOT a filter. The catalogue has no departure-date
 *   field, so dates are carried as a note for the enquiry, never used
 *   to claim a package departs on those dates.
 * Results are sorted price low→high (unpriced last, though with a
 * budget set there are no unpriced results by construction).
 */
import type { CatalogPackage } from './catalog';
import {
  searchPackages,
  sortPackages,
  getSearchPrice,
} from './search';

export interface QuizInput {
  /** ₹ cap, or null for "no budget limit". */
  budgetMax: number | null;
  /** Free-text interests, e.g. "goa beach family". */
  interests: string;
  /** Preferred travel dates, free text — a note, never a filter. */
  preferredDates: string;
}

export function matchQuizPackages(
  packages: CatalogPackage[],
  input: QuizInput,
): CatalogPackage[] {
  let matched = searchPackages(packages, input.interests);
  if (input.budgetMax !== null) {
    matched = matched.filter((pkg) => {
      const price = getSearchPrice(pkg);
      return price.hasPrice && price.deal <= input.budgetMax!;
    });
  }
  return sortPackages(matched, 'price-asc');
}
