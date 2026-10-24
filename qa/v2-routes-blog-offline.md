# v2 routes — Blog remainder (Category J, 93–100) + Offline & reliability (Category P, 151–160)

EXACT ROUTES SPEC for the coordinator to wire into `src/navigation/types.ts`
(`RootStackParamList`) and `App.tsx` (stack screens). Nothing in this
spec is wired yet by this batch: the batch owner was forbidden from
editing `App.tsx`, `src/navigation/*`, `app.json`, `package.json` and
`PackageImage.tsx`. All screens below are implemented and live in
`src/screens/`; the coordinator only adds the type entries + stack
screens (titles in brackets). No route below invents data: every screen
renders only real feed/catalogue/trip content or an honest empty state.

## New stack screens

| Route | Params | Title | Entry points |
|---|---|---|---|
| `BlogLibrary` | none (`undefined`) | "My library" | Blog screen "Saved offline" section footer link (coordinator adds a button there — the section itself already renders saved articles inline); Account/Settings "reading library" link if desired. |
| `BlogVideoGuides` | none (`undefined`) | "Video guides" | Blog screen "Videos" section (currently rendered inline as the same honest empty state); coordinator may point the section button here instead. |
| `DestinationHubs` | none (`undefined`) | "Destination guides" | Blog screen "Guides" section (currently rendered inline from the same hub builder); Home destination rows if desired. |
| `DestinationHub` | `{ category: string }` — the category name exactly as it appears in the catalogue/feed (e.g. `"Pilgrimage"`) | Category name (or "Destination guide" when empty) | `DestinationHubs` hub cards; Blog "Guides" inline hub cards (currently inline — coordinator retargets to this route). |
| `TripKit` | `{ ref: string }` — the enquiry reference of a real saved trip (`SavedTrip.ref` from `src/lib/trips.ts`) | "Trip kit" | Offline & Diagnostics trip-kit cards; Trips screen per-trip "Trip kit" action (coordinator adds). |
| `OfflineDiagnostics` | none (`undefined`) | "Offline & diagnostics" | Account screen "Offline & diagnostics" row (coordinator adds); Blog "Saved offline" section footer link if desired. |

## Existing routes reused (no changes needed)

- `BlogArticle` `{ slug: string; title: string }` — now also the
  offline-reader target: when the live fetch fails it renders the saved
  copy (bannered "saved offline copy") instead of failing.
- `PackageDetail` `{ slug: string }` — target of verified package links
  from articles and hub package cards.
- `Tabs` `{ screen: 'Chat' }` — hub FAQ entry point (the app's only FAQ
  copy lives in the Chat tab; hubs do not duplicate it).

## Screens NOT to wire as routes

- `BlogLibrary`, `DestinationHubs`, etc. are full screens, not tabs.
  Do not add them to the bottom tab bar; they are stack screens pushed
  above the tabs.

## Coordinator integration notes (from this batch's report)

1. **Foreground enquiry-queue flush (152):** call
   `registerForegroundFlush(() => void flushEnquiryQueue(item =>
   submitEnquiry(item.input, item.formRenderedAt)))` once in the app
   shell (`App.tsx`). Until then, retries happen only via the manual
   "Retry all queued" button on `OfflineDiagnostics`. No NetInfo is
   installed — this is an AppState foreground trigger, never a
   connectivity trigger.
2. **Blog notification deep links (97):** `lib/notifications.ts` has no
   `'blog'` entry kind and no `BlogArticle` deep link, so blog centre
   entries use kind `'reminder'` with no deep link (the entry names the
   article; the user opens it from Blog). If a real blog kind/link is
   added upstream, `checkNewBlogPosts` in `lib/reading.ts` should switch
   to it.
3. **Low-data package images (160):** `PackageImage.tsx` still always
   uses the `w=750` optimizer URL. To apply low-data mode to package
   cards, it must read `settings.dataSaver` and switch to
   `lowDataOptimizedUrl()` from `src/lib/lowdata.ts` (`w=640`, the
   smallest verified allowed width).
4. **Enquiry/booking form autosave (156):** `saveEnquiryFormDraft` /
   `loadEnquiryFormDraft` in `src/lib/drafts.ts` are ready, but
   `EnquiryScreen`/`BookingScreen` are owned by other builders — they
   must call save-on-change + restore-on-mount themselves. This batch
   proves the pattern in `BlogScreen` (search + category draft).
5. **FAQ gap (99):** there is no shared FAQ module — the only FAQ copy
   is the private `FAQS` array in `ChatScreen.tsx`. Hubs link to the
   Chat tab rather than duplicating or inventing FAQ text. If a shared
   FAQ module is created later, hubs should render it directly.
6. **Deferred, do not wire anything fake:** account-synced backup (159)
   — no account backend exists; PDF trip-kit export (153) — no PDF
   library installed; Sentry crash reporting (155) — no DSN decision.
   The local error log on `OfflineDiagnostics` is the diagnostics
   surface until a DSN is decided.
