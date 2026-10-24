# v2 store readiness (item 210) — PREP ONLY, nothing submitted

Status: preparation document. No Play listing was created or edited, no
Apple Developer account exists, no purchase was made, and NOTHING was
submitted to either store by this batch.

## 1. Screenshots checklist (Play listing)

Capture from a REAL device build (not web-export QA shots) before
submission. Web-export screenshots in `qa/shots-*` prove layout only;
they are not store assets.

| Asset | Status | Notes |
|---|---|---|
| App icon 512×512 | READY (source exists) | `assets/icon.png` + Android adaptive icon foreground/background/monochrome already in `app.json`. Verify the 512 export has no black bars (v1.1 item 141 fix) before upload. |
| Feature graphic 1024×500 | TODO | Not in repo. Must be made from real app screens + the real brand teal (#127C82); no stock photos presented as app screens. |
| Phone screenshots (min 2, portrait) | TODO | Home, package detail, enquiry, booking request, pay — real content, real prices only. Re-capture on the release build; do not reuse web-export shots. |
| 7" tablet screenshots | TODO | Only required if tablet distribution is claimed; `supportsTablet` is already true on iOS, so decide before submission whether to claim it. |
| 10" tablet screenshots | TODO | Same decision as 7" — only if tablet is claimed. |
| Promo video | NOT REQUIRED | Do not make one unless the business asks; never use stock footage as if it were MQT trips. |

Screenshot honesty rules (apply to every capture): real packages,
real prices via `getPriceInfo()`, no invented ratings/reviews/offers,
no fake countdowns, no stock-as-real photography.

## 2. Privacy-policy link check (verified in code)

- `DataPrivacyScreen` EXISTS (route `DataPrivacy`, v1.2) and is honest:
  it explains that profile/travelers/trips/settings live only on the
  device, offers local export (JSON via Share) and local delete, and
  states plainly that already-sent enquiries live in the team's Leads
  table and need a team request (call/WhatsApp buttons provided).
- What it does NOT do: it links to NO external privacy-policy URL.
  There is no privacy-policy link anywhere in the app code.
- Play requirement gap (coordinator/business input needed): Google Play
  requires a hosted privacy-policy URL on the listing. The app cannot
  invent one. Needed before submission: the business publishes a
  privacy policy page on myquicktrippers.com (or another stable URL)
  and the coordinator adds that exact URL to the Play listing (and,
  if desired, to DataPrivacyScreen in a later batch — not this one).
  Do NOT paste a guessed URL into the listing.

## 3. Data-safety form notes (state only what is true)

For the Play Data safety section, the true statements are:

- Data stored on-device only: profile, traveler profiles, saved trips,
  wishlist/compare selections, settings, notification preferences,
  diagnostics (item 209), search history. No account sync exists.
- Data sent to the business backend (myquicktrippers.com) when the user
  acts: enquiries (name, phone, optional email, package, travel date,
  message) into the Leads table via `/api/enquiries`; payments via the
  site's Razorpay backend (`/api/payments/razorpay/create-order`).
  The app never sees or stores card numbers or UPI PINs.
- Push token: retrieved on-device and stored locally only
  (`@mqt/push-token`); it is NEVER sent to any server (no push-sending
  backend exists — item 161-server deferred). Say so, do not claim
  push delivery.
- No data is sold, no third-party advertising SDK is in the app, no
  analytics SDK is in the app. Location is not collected (no map
  feature — item 27 deferred). Contacts, photos, and files are not
  read except where the user explicitly shares (system share sheet).
- Data deletion: in-app local delete (DataPrivacyScreen) + team
  contact for Leads-table rows. Account deletion (item 80) is the
  same two-part story — do not claim one-tap server deletion that
  does not exist.

Do NOT declare in the form: crash reporting (none configured), precise
location, advertising identifiers, or server-side account data — none
of those exist.

## 4. iOS path — PREPARED ONLY, NOT submitted

Blocker (stated plainly): no Apple Developer account exists ($99/yr).
No purchase is authorised by this batch and no submission was made.
The diff below is ready for the coordinator to apply AFTER the account
decision.

### EXACT app.json ios diff needed

Current `ios` block (verified in-repo):

```json
"ios": {
  "supportsTablet": true,
  "infoPlist": {
    "NSFaceIDUsageDescription": "Unlock the app with your fingerprint or face."
  }
}
```

Diff to apply (coordinator only):

```diff
     "ios": {
       "supportsTablet": true,
+      "bundleIdentifier": "com.anonymous.mqtapp",
       "infoPlist": {
-        "NSFaceIDUsageDescription": "Unlock the app with your fingerprint or face."
+        "NSFaceIDUsageDescription": "Unlock the app with your fingerprint or face.",
+        "ITSAppUsesNonExemptEncryption": false
       }
     },
```

Notes:

- `bundleIdentifier` reuses the Android application id string so the
  two stores share one identity; the coordinator must confirm no other
  app already claims it in App Store Connect before applying.
- `ITSAppUsesNonExemptEncryption: false` is correct only because the
  app uses platform-standard HTTPS/Razorpay encryption and no custom
  cryptography. If that ever changes, this value must be revisited.
- Icon and splash are REUSED, no new assets needed: `icon`
  (`./assets/icon.png`) and `splash.image` (`./assets/splash-icon.png`,
  background `#127C82`) already exist and are platform-neutral.
- `supportsTablet` is already `true` — no change needed there.
- NOT in this diff (deliberately): no `associatedDomains` (deep links,
  item 2, are a separate batch), no camera/photo-library usage strings
  (no such feature ships), no push entitlement (no push backend).
- After the account exists, the remaining iOS steps are: EAS build for
  iOS, App Store Connect listing (screenshots per Apple sizes, same
  honesty rules as §1), privacy-policy URL (same gap as §2), and
  `eas submit --platform ios`. None of those steps was taken here.

## 5. Pre-submission gate (coordinator checklist)

- [ ] Privacy-policy URL published + entered in Play listing (§2).
- [ ] Real-device screenshots captured (§1) — not web-export shots.
- [ ] Data-safety form filled from §3 only — no invented declarations.
- [ ] Release build installed and tapped through on a real phone
      (enquiry pre-submit state only; submit NOTHING real in QA).
- [ ] Rollout plan from qa/v2-rollout-runbook.md agreed (Play staged
      % + OTA % are independent numbers).
- [ ] iOS: Apple Developer account decision made by the business
      ($99/yr) before any iOS work is promised.
