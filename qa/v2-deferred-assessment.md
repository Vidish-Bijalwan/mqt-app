# v2 deferred-item retries — assessment (Category U batch)

Method: each item was checked against the actual repo (catalogue
fields, lib code, screen code, package.json) on 2026-10-25. DONE is
claimed only with a real data source cited. Nothing was built for a
deferred item, no data was invented, and no package was installed.

## Results

| Item | Verdict | Exact reason / evidence |
|---|---|---|
| 27 Map-based discovery | DEFERRED | Bundled catalogue (`src/data/packages.json`, 652 entries) has exactly 9 keys: slug, title, category, image, duration, route, description, mrp, dealPrice — no latitude/longitude/coordinate field anywhere, and the live feed maps to the same shape (`mapCatalogEntry` in `src/lib/catalog.ts`). Plotting pins would require invented locations. Already recorded as deferred in `src/lib/search.ts`. |
| 30 Voice search | DEFERRED | No recogniser is installed (`package.json` has no speech package). Prior v1.3 note (in `src/lib/search.ts`) stands: `expo-speech` is text-to-speech only; `@react-native-voice/voice` is a legacy bridge; the maintained SDK-58 recogniser (`expo-speech-recognition` 58.0.0) is a native TurboModule needing a config plugin, the RECORD_AUDIO permission, and a new native build — which this batch cannot do (no installs, no builds, web-export verification only). Shipping a fake "listening" UI is forbidden by the honesty rules, so nothing ships. |
| 32-full Day-wise itinerary | DEFERRED | No day/meal/stay field exists: catalogue has only a `route` string. `PackageDetailScreen` already says so in code and renders "Route stops" (stops, NOT days) with an honest note that day-wise details are not available. Splitting the route string on "→" into fake "days" would invent itinerary structure. |
| 34 Availability calendar | DEFERRED | No operator data exists: no departure-date or seats field in the catalogue, no availability endpoint in `src/lib/api.ts`. `PackageDetailScreen` states departure dates/seats are confirmed by the team on callback. A calendar with dates would be invented availability. |
| 37 Reviews display | DEFERRED (confirmed) | No verified review source exists: no review field, endpoint, or Google-reviews integration anywhere in the app. `PackageDetailScreen` already renders an honest "not available yet" note instead of reviews. Confirmed deferred, as expected. |
| 47 Coupons | DEFERRED | No coupon system exists: no coupon endpoint, no code-validation call, no discount field. `BookingScreen`/`src/lib/booking.ts` explicitly state discounts are "to be confirmed by the team on callback (no coupon code)". A coupon field would promise discounts the business has not defined. |
| 49-PDF Voucher PDF | DEFERRED (confirmed) | No booking exists to voucher: the app only sends booking REQUESTS (enquiries via the Leads table); there is no confirmed booking, booking id, or voucher data. `BookingScreen` states no confirmation number is invented. A PDF would be a fake confirmation document. |
| 161-server Push sending backend | DEFERRED (confirmed) | No server route sends push and no token store exists on the server. Client side only: permission flow + Expo push token stored locally (`@mqt/push-token`), never sent anywhere (`src/lib/notifications.ts` header). Local scheduling (v1.3) is done; remote delivery is not. |
| 164 Offer alerts | DEFERRED | No offers feed exists: `appConfig` carries only an `offersBannerEnabled` boolean flag and banners with title/subtitle/target — no offer objects, dates, or terms. The `offers` notification preference is recorded but gates nothing (labelled honestly in UI). Future path: a real offers feed via remote config, then wire the existing preference to it. |
| 165 Chat notifications | DEFERRED (confirmed) | No two-way chat backend and no team inbox UI exist. `ChatScreen` submits messages as enquiries (prefixed "App chat") with a WhatsApp handoff; there is no conversation to notify about. Confirmed deferred. |
| 169 Seasonality alerts | DEFERRED | No seasonality/festival feed exists: no feed, endpoint, or per-destination season field in the catalogue (only free-text `description`/`route`). The only "season" mentions in code are notification-centre labels and booking copy. Nothing schedulable exists to alert on. Future path: same remote-config mechanism as item 164 (a dated feed), not title-keyword guessing. |
| Full two-way chat inbox | DEFERRED (confirmed) | No team inbox UI and no live chat transport exist (see 165). `ChatScreen` header comment states this explicitly. Confirmed deferred. |

## Summary

- DONE via retry: none. Every retried item still lacks a real data
  source, so every one stays DEFERRED with the reason above.
- The honest placeholders already in the app (route stops, reviews
  note, availability note, no-coupon note, chat-as-enquiry, local-only
  push token) are all still correct and were NOT changed by this batch.
- Future unblockers, in order of leverage: (1) a real offers/seasonality
  feed in remote config (unblocks 164, 169); (2) a push-sending backend
  + token store (unblocks 161-server, then 165 only if chat goes
  two-way); (3) operator availability + day-wise itinerary data in the
  package feed (unblocks 34, 32-full); (4) per-package coordinates
  (unblocks 27); (5) a business-defined coupon system (unblocks 47);
  (6) verified reviews source (unblocks 37); (7) confirmed bookings
  (unblocks 49-PDF). None of these exists today.
