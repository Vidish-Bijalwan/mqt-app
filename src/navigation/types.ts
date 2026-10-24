/**
 * Typed React Navigation params — Builder B: keep these route names and
 * param shapes stable. Enquiry / Pay / Blog / PaySuccess are TODO-B
 * placeholders in App.tsx; when you implement them, replace the placeholder
 * component but DO NOT rename the routes or change these params without
 * updating HomeScreen / PackageDetailScreen call sites.
 */
export type RootStackParamList = {
  Home: undefined;
  PackageDetail: { slug: string };
  /** TODO-B: enquiry form for a package (same Leads table as the website). */
  Enquiry: { slug: string; packageName: string };
  /** TODO-B: Razorpay checkout (same backend as /pay). `amount` is the
   *  numeric deal price from getPriceInfo() when hasPrice, else 0/omitted
   *  and the Pay screen must treat it as "amount to be confirmed". */
  Pay: { slug: string; packageName: string; amount: number };
  /** TODO-B: blog reading. */
  Blog: undefined;
  /** TODO-B: shown after a successful payment. */
  PaySuccess: { orderId?: string; paymentId?: string };
};
