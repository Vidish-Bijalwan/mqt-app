# My Quick Trippers — mobile app (v1)

React Native + Expo (TypeScript), one codebase for Android + iOS.
Companion to https://www.myquicktrippers.com — it does not replace the website.

## What Builder A built

- **Home**: branding header (teal `#127C82`), search (title/category),
  category filter chips (all 13 categories in the data), scrollable package
  cards with real site photos and price blocks. Tap a card → detail.
- **PackageDetail**: large photo, title, category, duration, route,
  description, price block + the note "Prices as listed on
  myquicktrippers.com; final quote is confirmed on enquiry.", and
  Enquire / Pay / Call / WhatsApp buttons.
- **Call / WhatsApp are live now**: `tel:+918171158569` and
  `https://wa.me/918171158569` with a prefilled package enquiry text.
- **Data owned by the app** (not `/tmp`):
  - `src/data/packages.json` — 652 public packages (trimmed fields)
  - `src/data/priceOverrides.json` — 709 entries
  - `src/data/packages.ts` — typed catalogue + `packageImageUrl()`
    (site-absolute URL: `https://www.myquicktrippers.com` + image path)

## Price rules — read before touching prices

All prices go through `getPriceInfo()` in `src/lib/price.ts` (a port of the
website's `getPriceInfo()`). **Never render a package's raw `mrp` /
`dealPrice` directly.**

- `parseINR` strips non-digits; `MINIMUM_PUBLIC_PRICE = 10000`.
- Overrides win over raw fields. International = `category ===
  'International'` EXCEPT titles/slugs matching
  `/adi kailash|chennai mahabalipuram/i` (domestic for pricing).
- International: usable originals (`originalDeal >= 10000/2.5`,
  `originalMrp >= originalDeal`, `originalDeal >= originalMrp * 0.5`) are
  used, otherwise raw/1.5; then ×2.5 and rounded. Domestic: raw
  (override-first) values as-is.
- Sentinel fallback: if ANY of rawMrp, rawDeal, originalMrp, originalDeal
  equals `2` or `24750` → `hasPrice = false`.
- `deal = dealValue > 0 ? dealValue : mrpValue`;
  `hasPrice = deal >= 10000 && !isFallback`;
  `display` = en-IN formatted deal (or `''`); `crossed` = en-IN MRP when
  `mrp > deal`; `estimated` = applied override has `estimated: true`.
- When `hasPrice` is false the UI shows **"Pricing on request"** — never a
  made-up number. Missing/broken photos show a grey **"Photo unavailable"**
  box — never a fake or AI photo presented as real.

## Notes for Builder B (enquiry / pay / blog)

- **Routes (do not rename)**: `Home`, `PackageDetail`, `Enquiry`, `Pay`,
  `Blog`, `PaySuccess` — registered in `App.tsx`, typed in
  `src/navigation/types.ts`. All six are real screens (Builder B replaced
  the placeholders; `PlaceholderScreen` was deleted after reviewer
  REQUEST CHANGES).
- **Param types** (`src/navigation/types.ts`):
  - `PackageDetail: { slug: string }`
  - `Enquiry: { slug: string; packageName: string }`
  - `Pay: { slug: string; packageName: string; amount: number }` —
    `amount` is the numeric deal from `getPriceInfo()` when `hasPrice`,
    else `0` (treat as "amount to be confirmed", never invent one).
  - `Blog: undefined`
  - `PaySuccess: { orderId?: string; paymentId?: string }`
- **Extension points**: add screens under `src/screens/`, swap the
  TODO-B placeholder components in `App.tsx`, keep the route names/params.
  `react-native-webview` is intentionally NOT installed yet — add it when
  you need it for Pay/Blog. No secrets anywhere in code (no keys, tokens,
  or passwords); the Razorpay backend is the same as the website's `/pay`.
- **Assets**: `assets/logo.png` (header logo, square business logo),
  `assets/icon.png` (1024×1024 app icon, logo on a `#127C82` canvas).

## What Builder B built

- **Enquiry** (`src/screens/EnquiryScreen.tsx`): name/phone/email/
  travelDate/travellers/message, client validation mirroring the server
  (name ≥2, phone 8–15 digits, YYYY-MM-DD not in the past in
  Asia/Kolkata, travellers 1–50); POSTs to `/api/enquiries` with the
  `company: ""` honeypot (never rendered) and a mount-time
  `formRenderedAt`. 201 shows the returned `ref` + WhatsApp button;
  400 shows the server text; 429/503/network failure shows the WhatsApp
  fallback — never a dead end.
- **Pay** (`src/screens/PayScreen.tsx`): amount prefilled from the
  package deal (0 = "Amount to be confirmed — enter the advance
  amount", user-typed ₹1–10,00,000), phone must be a valid 10-digit
  Indian mobile. POSTs to the LIVE `/api/payments/razorpay/create-order`
  (never the legacy Cashfree route); checkout.js runs in a WebView from
  a bundled HTML string using only the backend-returned `keyId` +
  `order_id`. Success (provider callback only) → PaySuccess; dismiss/
  failure → honest message + retry, never a fake success.
- **Blog** (`src/screens/BlogScreen.tsx`): WebView of
  `https://www.myquicktrippers.com/blog` with loading + error states
  ("Open in browser"). Native list was NOT built because
  `GET /api/blog/posts` returns `{"posts":[]}` (empty CMS table) — no
  fake posts bundled.
- **Web preview limitation**: react-native-webview does not run on web,
  so Pay on web opens `https://www.myquicktrippers.com/pay` (noted
  on-screen) and Blog on web offers "Open blog in browser".
- **Native-SDK note**: checkout.js-in-WebView is used because the native
  react-native-razorpay SDK needs a dev build that cannot be verified
  on this VM — v2 can swap it in.
- `src/lib/contact.ts` centralises `tel:+918171158569` /
  `wa.me/918171158569`; PackageDetail's Call/WhatsApp buttons were
  rewired to it (tsc still clean). No secrets in code.

## Develop

```sh
npm install
npx tsc --noEmit
npx expo start          # or: npx expo export --platform web
```

No Android SDK / emulator testing was possible on the build VM (no Android
SDK/Java) — verify on a real device or Expo Go before release.
