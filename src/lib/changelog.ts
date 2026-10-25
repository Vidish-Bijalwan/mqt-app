/**
 * Real changelog (v2, item 206). Every entry describes only features
 * that actually shipped in that batch — derived from the git history
 * (v1, v1.2 and v1.3 checkpoint commits) and the backlog's build order
 * (v1.1 / v1.2 / v1.3 batch lists). Nothing here is invented: features
 * that stayed deferred (day-wise itineraries, live reviews, availability
 * calendar, coupon codes, OTP login, remote push sending) are NOT listed
 * as shipped, and must never be added here without a real release.
 *
 * Version rule: entries are ordered newest-first for display. The
 * coordinator bumps APP_VERSION on release; WhatsNewScreen filters by
 * `sinceVersion` so only entries newer than the last-seen version show
 * after an update. The v2.0 entry lists only this batch's Category U
 * work (items 205-210); other v2 work is owned by sibling builders and
 * is added here by the coordinator when it lands, never pre-claimed.
 */

export interface ChangelogEntry {
  version: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.1',
    title: "What's new in v2.0.1",
    items: [
      'Faster package lists: the catalogue now loads once per session instead of once per screen, so tabs respond instead of freezing on slow connections.',
      'Package details open instantly from lists, with a loading state instead of a false “could not be found” while the catalogue is still loading.',
      'Blog feed layout fixed so posts display, with the category filter in one scrolling row and a “Show all posts” reset.',
      'Account and package-detail actions regrouped into compact cards instead of long stacks of large buttons.',
    ],
  },
  {
    version: '2.0.0',
    title: "What's new in v2.0",
    items: [
      "What's new screen: this changelog now appears after each update.",
      'Home layout experiment: the home list now runs in a compact or comfortable density, chosen by remote config.',
      'Release-health screen: startup time, on-device error counts and last sync stamp, kept on your device only.',
      'Maintenance mode verified end to end: honest downtime screen with call and WhatsApp fallback.',
      'Staged OTA rollouts with instant rollback, so a bad update can be reverted without a store release.',
    ],
  },
  {
    version: '1.3.0',
    title: "What's new in v1.3",
    items: [
      'Full-text search across all packages, with filters, sorting and curated collections (under ₹25,000, weekend getaways, pilgrimage circuits).',
      'Richer package details: route-stops timeline, honest price breakdown and availability notes (confirmed by the team on callback).',
      'Step-based booking request flow: dates, travelers, rooms and a review-before-pay summary — a request to the team, never a confirmed booking.',
      'Local reminders and a notification centre: departure reminders, price-drop alerts for saved packages, and one-time enquiry reminders.',
      'Compare up to 3 packages and save packages to a wishlist, all on your device.',
    ],
  },
  {
    version: '1.2.0',
    title: "What's new in v1.2",
    items: [
      'Live catalogue: package lists now refresh from the website, with the saved catalogue as an offline fallback.',
      'Over-the-air updates and remote config: fixes and banners arrive without a reinstall.',
      'Update prompts: a soft nudge for normal updates and a forced screen (with WhatsApp/call fallback) for critical ones.',
      'In-app chat: messages reach the team as enquiries, with FAQ answers for payments, cancellations and permits.',
      'Account and settings: profile, theme, language, travelers, communication preferences, and data export / delete on your device.',
    ],
  },
  {
    version: '1.1.0',
    title: "What's new in v1.1",
    items: [
      'Bottom tab bar: Home, Packages, Trips, Chat and Account, always in thumb reach.',
      'Proper adaptive icon and header logo — no more stretched banner icon.',
      'Faster lists and images: virtualised package lists and cached, resized photos.',
      'Native Razorpay checkout, so UPI apps open and return cleanly.',
      'Native blog list, phone-sized layouts, swipe gestures and smooth screen transitions.',
    ],
  },
  {
    version: '1.0.0',
    title: 'Welcome to My Quick Trippers',
    items: [
      'Browse tour packages with real prices and photos from myquicktrippers.com.',
      'Send enquiries straight to the team from any package.',
      'Pay securely via Razorpay, and read travel guides in the blog.',
    ],
  },
];
