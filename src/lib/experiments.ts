/**
 * A/B testing hooks (v2, item 208). Config-flag-driven variant selection
 * with a safe default and NO network dependency on the default path.
 *
 * How it works:
 * - Callers pass the already-resolved remote-config flags (a plain
 *   record). This module never fetches anything itself, so when no flag
 *   is present the default variant applies instantly, offline.
 * - Flag keys are `exp_<experiment-id>` (e.g. `exp_home-card-density`).
 *   Recognised values: 'A' / 'comfortable' -> variant A, 'B' /
 *   'compact' -> variant B. Anything else (missing, mistyped, wrong
 *   type) falls back to the experiment's default variant — never a
 *   crash, never a half-rendered layout.
 *
 * COORDINATOR NOTE (flag delivery, not this file): AppFlags in
 * src/lib/appConfig.ts currently parses only chatEnabled and
 * offersBannerEnabled, so a site-emitted `exp_home-card-density` flag
 * would be dropped by parseAppConfig today. Until the coordinator adds
 * that field to AppFlags + parseAppConfig, the home experiment always
 * resolves to its default (comfortable). The resolver below already
 * honours the flag the moment it arrives; no change here is needed.
 * No experiment here invents data: both variants render the same real
 * package list (see HomeScreen's delimited v2 block).
 */

export type ExperimentVariant = 'A' | 'B';
export type CardDensity = 'comfortable' | 'compact';

/** Home card-density experiment (item 208). A = comfortable, B = compact. */
export const HOME_DENSITY_EXPERIMENT = 'home-card-density';

export const HOME_DENSITY_FLAG_KEY = `exp_${HOME_DENSITY_EXPERIMENT}`;

/** Default variant per experiment. Unknown ids default to 'A'. */
export function defaultVariantFor(experimentId: string): ExperimentVariant {
  void experimentId;
  return 'A';
}

/**
 * Resolve a variant from a raw flag value. Pure and synchronous:
 * no storage, no network. Unrecognised values return `defaultVariant`.
 */
export function resolveExperimentVariant(
  flagValue: unknown,
  defaultVariant: ExperimentVariant = 'A',
): ExperimentVariant {
  if (flagValue === 'B' || flagValue === 'compact') return 'B';
  if (flagValue === 'A' || flagValue === 'comfortable') return 'A';
  return defaultVariant;
}

/**
 * Resolve a variant from a flags record (e.g. config.flags). Missing
 * flags, a missing key, or a null record all yield the default.
 * Accepts `unknown` so typed flag objects (AppFlags, which has no index
 * signature) pass without a cast at the call site.
 */
export function variantFromFlags(
  experimentId: string,
  flags: unknown,
  defaultVariant: ExperimentVariant = 'A',
): ExperimentVariant {
  if (typeof flags !== 'object' || flags === null) return defaultVariant;
  const record = flags as Record<string, unknown>;
  return resolveExperimentVariant(
    record[`exp_${experimentId}`],
    defaultVariant,
  );
}

/** Variant A renders comfortable density; variant B renders compact. */
export function densityForVariant(variant: ExperimentVariant): CardDensity {
  return variant === 'B' ? 'compact' : 'comfortable';
}

/**
 * Home card density for the given flags record. Safe default:
 * 'comfortable' when no flag is present (the current shipped state).
 */
export function getHomeCardDensity(flags: unknown): CardDensity {
  return densityForVariant(
    variantFromFlags(
      HOME_DENSITY_EXPERIMENT,
      flags,
      defaultVariantFor(HOME_DENSITY_EXPERIMENT),
    ),
  );
}
