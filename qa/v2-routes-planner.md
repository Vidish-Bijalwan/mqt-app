# v2 routes spec — Planner / My Trips batch (items 81–90, 181–190)

Coordinator wiring spec. This batch owns TripsScreen.tsx and the new
files below; it did NOT edit App.tsx, src/navigation/*, or any other
screen, so the routes below are not yet registered. Screens navigate
via a documented cast until registration lands.

## New stack screens

### Planner
- Route name: `Planner`
- Params: `{ focusTripId?: string }` (all optional; undefined = planner home)
- Component: `src/screens/PlannerScreen.tsx` (`PlannerScreen`)
- Entry points (already coded in TripsScreen.tsx):
  - Trips tab → "Trip planner" button
  - Trips tab → planner-trip card → "Open in planner"
  - TripDetailScreen → "Open trip planner" (saved trips only)
- Title suggestion: "Trip planner"

### TripDetail
- Route name: `TripDetail`
- Params:
  - `kind: 'saved' | 'planner'` (required)
  - `ref?: string` — saved-trip enquiry ref (kind 'saved')
  - `plannerId?: string` — planner trip id (kind 'planner')
  - `slug: string` — package slug; '' allowed for a plan with no packages yet
  - `packageName: string` — display name (package title, or plan name when slug is '')
  - `travelDate?: string` — YYYY-MM-DD from the booking request / plan
- Component: `src/screens/TripDetailScreen.tsx` (`TripDetailScreen`)
- Entry points (already coded):
  - Trips tab → saved-trip card → "Trip details"
  - Trips tab → planner-trip card → "Trip details"
  - PlannerScreen → plan card → "Open trip details"
- Title suggestion: "Trip details"
- Outbound (already coded, existing routes):
  - `Enquiry` with `{ slug, packageName, travelerCount?, travelerNames?, contactPref? }`
    for post-trip feedback (contactPref carries a "Post-trip feedback"
    line) and for "Book again" rebooking (items 188/189). No Enquiry
    params were changed; both use the existing optional params.
  - `PackageDetail` with `{ slug }` from PlannerScreen package rows.
  - `Planner` with `{}` from TripDetailScreen.

## Types registration (coordinator)
Add to `RootStackParamList` in `src/navigation/types.ts`:
```ts
Planner: { focusTripId?: string } | undefined;
TripDetail: {
  kind: 'saved' | 'planner';
  ref?: string;
  plannerId?: string;
  slug: string;
  packageName: string;
  travelDate?: string;
};
```
Then replace the cast navigations in TripsScreen.tsx,
PlannerScreen.tsx and TripDetailScreen.tsx with typed navigations
(search for "cast" / "coordinator" comments in those files).

## App.tsx registration (coordinator)
```tsx
import { PlannerScreen } from './src/screens/PlannerScreen';
import { TripDetailScreen } from './src/screens/TripDetailScreen';
// inside the Stack.Navigator:
<Stack.Screen name="Planner" component={PlannerScreen} options={{ title: 'Trip planner' }} />
<Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Trip details' }} />
```

## Follow-up hooks for other owners (NOT done by this batch)
1. PackageDetailScreen owner: on package-detail view, call
   `recordPriceSnapshot(slug, getSearchPrice(pkg).display)` from
   `src/lib/priceHistory.ts` (item 84 full coverage) and
   `recordViewed(slug)` from `src/lib/recentHistory.ts` (item 88 full
   coverage). This batch's own screens already call both; only the
   PackageDetail path is still unwired because this batch must not
   edit that screen.
2. PackageDetailScreen owner (item 87): add a "My note" entry point
   opening a note editor backed by `getPackageNote` / `setPackageNote`
   from `src/lib/notes.ts`. Editing UI already exists in PlannerScreen
   and TripDetailScreen.
3. No other route, param or navigation change is needed for this batch.
