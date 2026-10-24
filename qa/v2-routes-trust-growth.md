# v2 Trust & Growth — ROUTES spec for the coordinator (DO NOT EDIT navigation in this batch)

New screens are written and typecheck-clean but NOT wired into
`App.tsx` / `src/navigation/types.ts` (file rules: those files belong
to the coordinator). Wire exactly as below. No route below invents a
price, rating, review, offer, or benefit.

## New stack screens (add to RootStackParamList + Stack.Navigator)

| Route name | Params | Entry points |
|---|---|---|
| `Trust` | `{ packageName?: string } \| undefined` | Account tab "Trust & safety" link (new entry point for coordinator to add); PackageDetail "Why trust us" link; Offers hub footer link. Props today: `TrustScreen({ packageName, onReportIssue })` — wire `onReportIssue` to navigate to `ReportIssue`. |
| `Offers` | `undefined` | Account tab / Home "Offers & more" entry. Props: `OffersScreen({ onGroupEnquiry, onGiftTrip, onReferral, onInvite })` → navigate to `GroupEnquiry`, `GiftTrip`, `Referral`, `Invite` respectively. |
| `Referral` | `undefined` | From `Offers` ("Refer & invite") and from `Invite`. No params. |
| `Invite` | `undefined` | From `Offers` and `Referral`. No params. |
| `ReportIssue` | `{ packageName?: string; packageRef?: string } \| undefined` | From `Trust` ("Report wrong info") and from PackageDetail ("Report wrong info"). |
| `GroupEnquiry` | `{ packageName?: string } \| undefined` | From `Offers` ("Group booking", "School / corporate trips") and from PackageDetail group CTA. |
| `GiftTrip` | `{ packageName?: string } \| undefined` | From `Offers` ("Gift a trip") and from PackageDetail gift CTA. |

## Existing routes reused (no changes)

- `Enquiry` — review/report/group/gift submissions already go through
  `submitEnquiry` directly from the new screens (same Leads table);
  the screens do NOT navigate to `Enquiry` for submission.
- `Pay` / `PaySuccess` — gift flow uses the normal pay flow after the
  team confirms the quote; no new pay route is needed.
- Package share links use `https://www.myquicktrippers.com/packages/<slug>`
  (verified site pattern; see `src/lib/booking.ts` `packageSiteUrl`).

## QR dependency note (item 194) — exact integration for the coordinator

- Dependency NOT installed (this batch must not install packages):
  `react-native-qrcode-svg` — install with `npx expo install react-native-qrcode-svg`
  (it also needs `react-native-svg`, which is a peer; `npx expo install`
  resolves the SDK-compatible versions).
- Integration: in `src/screens/InviteScreen.tsx`, replace the
  "QR code coming soon" `qrBox` View with:
  `<QRCode value={link} size={220} backgroundColor="#FFFFFF" color="#1A1A1A" />`
  (import `QRCode from 'react-native-qrcode-svg'`), keeping the link
  text and Share button unchanged. The QR value must be exactly the
  same `link` string shown on screen (referral link when a record
  exists, else the site home URL). Do NOT render a QR for any other
  value, and do NOT ship a static QR image file.
- Until that lands, `InviteScreen` is link + Share sheet only, and the
  placeholder box says so honestly — it is not a QR image.

## Blog-reader affiliate footer (item 196, coordinator note)

- The affiliate disclosure lives in `TrustScreen` ("Affiliate
  transparency" section). The blog reader (`BlogArticleScreen`) is
  outside this batch's ownership, so the short footer note in the
  reader path was NOT added here. Coordinator: add one line to the
  article footer — "Some links in articles may be affiliate links: we
  may earn a small commission at no extra cost to you." — or confirm
  the reader already carries the site's own disclosure.

## Icon audit note (item 149, coordinator note)

- Owned files use Ionicons only (the `✕` glyph in `FilterSheet` was
  replaced with `Ionicons name="close"`). Files outside this batch
  were NOT edited; a grep for emoji glyphs in other screens is left
  to the coordinator — no mixed-icon violations were introduced here.

## Splash (item 143) — EXACT app.json diff for the coordinator to apply

New asset (created, not wired — app.json is coordinator-owned):
`assets/splash-icon-v2.png` — 1024×1024, full-bleed teal `#127C82`
background, white MQT mark (from `assets/logo-white.png`, aspect
preserved, 720px wide, centred). No stretched logo, no white flash
(background matches the asset).

```diff
     "splash": {
-      "image": "./assets/splash-icon.png",
+      "image": "./assets/splash-icon-v2.png",
       "backgroundColor": "#127C82"
     },
```

Note: this changes only the splash image path. The `backgroundColor`
is already `#127C82`, so no flash colour change is needed. Splash
changes are native config: they ship with a new APK build, not OTA.

## Theme/font coverage (items 148 + gap fixes)

- Dark palette completed in `src/theme/tokens.ts`: added `inputBg`,
  `successBg`, `successText` to BOTH `COLORS` and `DARK_COLORS`.
  `SettingsContext` theme wiring already existed (light → `COLORS`,
  dark → `DARK_COLORS`) and was verified, not rewritten.
- Theme + `fs()` applied in owned files: `PackageList` (inner cards),
  `PackageGallery`, `PriceBlock`, `FilterSheet`, `PayScreen`,
  `PaySuccessScreen`. Payment logic, filter logic, and gallery
  behaviour are unchanged — only colours/fonts moved to theme.
- Verified-dark screens (this batch): Trust, Offers, Referral, Invite,
  ReportIssue, GroupEnquiry, GiftTrip (built themed from scratch),
  plus the six gap-fix files above (themed styles, dark palette
  applied). Full-app dark coverage remains partial — screens outside
  this batch were not audited or changed.
