import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CatalogPackage } from '../lib/catalog';

/**
 * Typed React Navigation params. Route names and param shapes for the
 * existing detail screens are stable (see HomeScreen / PackageDetailScreen
 * call sites). v1.1 adds the bottom-tab navigator: the stack's first
 * screen is Tabs, and Home now lives as a tab inside it.
 * v1.2 adds the Chat tab, BlogArticle, Travelers, Login, DataPrivacy.
 */
export type TabParamList = {
  Home: undefined;
  Packages: undefined;
  Trips: undefined;
  /**
   * Chat tab. All params optional: slug/packageName prefill the chat
   * context (from a package detail or a saved trip), ref carries a
   * booking/enquiry reference. Undefined = open chat with no context.
   */
  Chat:
    | { slug?: string; packageName?: string; ref?: string }
    | undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  /**
   * Legacy: Home now lives as a tab inside Tabs, and the stack does not
   * register a Home screen. This entry is kept only so existing call
   * sites that still reference 'Home' (PaySuccessScreen) keep typechecking
   * until their owners retarget them to Tabs. Do not add a Home screen
   * back to the stack.
   */
  Home: undefined;
  /**
   * v2.0.1: list screens pass the full package object alongside the
   * slug so detail renders immediately even while the shared catalogue
   * is still loading. `package` is optional: slug-only navigations
   * (notifications, trips, blog hubs) still work via the catalogue
   * lookup, gated on catalogue loading. No cycle: catalog.ts does not
   * import this file.
   */
  PackageDetail: { slug: string; package?: CatalogPackage };
  /**
   * Enquiry form for a package (same Leads table as the website).
   * v1.2 optional params: travelerCount / travelerNames prefill the
   * travellers fields, contactPref appends a preferred-contact line.
   */
  Enquiry: {
    slug: string;
    packageName: string;
    travelerCount?: number;
    travelerNames?: string;
    contactPref?: string;
  };
  /** Razorpay checkout (same backend as /pay). `amount` is the
   *  numeric deal price from getPriceInfo() when hasPrice, else 0/omitted
   *  and the Pay screen must treat it as "amount to be confirmed". */
  Pay: { slug: string; packageName: string; amount: number };
  /** Blog reading (native list). */
  Blog: undefined;
  /** Single blog article (WebView until a later batch). */
  BlogArticle: { slug: string; title: string };
  /** Traveler profiles (device-local CRUD). */
  Travelers: undefined;
  /** OTP login placeholder — item 71 BLOCKED, not connected. */
  Login: undefined;
  /** Local data export / delete. */
  DataPrivacy: undefined;
  /** Shown after a successful payment. */
  PaySuccess: { orderId?: string; paymentId?: string };
  /** Booking REQUEST flow (v1.3, items 41–50) — an enquiry through the
   *  existing lead channel, never a confirmed booking. */
  Booking: { slug: string; packageName: string };
  /**
   * v1.3 search & discovery (Category C). Both params optional:
   * query pre-fills the search box, collection pre-applies a curated
   * collection filter ('under25k' | 'weekend' | 'pilgrimage').
   * Undefined = open with the persisted search state.
   */
  Search: { query?: string; collection?: string } | undefined;
  /** v1.3 compare (up to 3 packages, selection device-local). */
  Compare: undefined;
  /** In-app notification centre (v1.3, item 167). No params. */
  Notifications: undefined;
  /** v2 trip planner (items 81–90). */
  Planner: { focusTripId?: string } | undefined;
  /** v2 trip detail (items 181–190). */
  TripDetail: {
    kind: 'saved' | 'planner';
    ref?: string;
    plannerId?: string;
    slug: string;
    packageName: string;
    travelDate?: string;
  };
  /** v2 blog library / video guides / destination hubs (items 93–100). */
  BlogLibrary: undefined;
  BlogVideoGuides: undefined;
  DestinationHubs: undefined;
  DestinationHub: { category: string };
  /** v2 trip kit + offline diagnostics (items 151–160). */
  TripKit: { ref: string };
  OfflineDiagnostics: undefined;
  /** v2 trust & growth (items 171–180, 191–200). */
  Trust: { packageName?: string } | undefined;
  Offers: undefined;
  Referral: undefined;
  Invite: undefined;
  ReportIssue: { packageName?: string; packageRef?: string } | undefined;
  GroupEnquiry: { packageName?: string } | undefined;
  GiftTrip: { packageName?: string } | undefined;
  /** v2 release health (item 209). WhatsNew is a launch-gate
   *  interstitial, not a stack route. */
  Diagnostics: undefined;
};
