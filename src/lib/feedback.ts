/**
 * Feedback + growth helpers (v2, items 171/180/197/198/199).
 *
 * Everything here routes through the EXISTING leads channel
 * (submitEnquiry → the website's enquiries table). Nothing is sent to
 * a reviews database, because no verified review source exists: review
 * submissions are explicitly labelled "for verification before display"
 * and are never shown back as published reviews. No fix SLA is promised
 * anywhere — none exists.
 */
import { listTrips } from './trips';

/** Prefix markers so the team can triage app feedback in the Leads table. */
export function reviewSubmissionMessage(args: {
  packageName?: string;
  tripDate?: string;
  review: string;
}): string {
  const parts = ['[App review submission — please verify before display]'];
  if (args.packageName !== undefined && args.packageName.trim() !== '') {
    parts.push(`Package: ${args.packageName.trim()}`);
  }
  if (args.tripDate !== undefined && args.tripDate.trim() !== '') {
    parts.push(`Trip date (as stated by traveller): ${args.tripDate.trim()}`);
  }
  parts.push(args.review.trim());
  return parts.join('\n');
}

export function reportIssueMessage(args: {
  packageName?: string;
  packageRef?: string;
  details: string;
}): string {
  const parts = ['[Report wrong info — app]'];
  if (args.packageName !== undefined && args.packageName.trim() !== '') {
    parts.push(`Package: ${args.packageName.trim()}`);
  }
  if (args.packageRef !== undefined && args.packageRef.trim() !== '') {
    parts.push(`Reference: ${args.packageRef.trim()}`);
  }
  parts.push(args.details.trim());
  return parts.join('\n');
}

/** "Returning traveller" flag (item 197): true only when this device
 *  holds at least one saved trip record. No perks are attached — the
 *  flag is shown as a "returning traveller" note in enquiry/chat
 *  context plus a priority-support note, nothing more. */
export async function isReturningTraveller(): Promise<boolean> {
  const trips = await listTrips();
  return trips.length > 0;
}

export async function returningTravellerNote(): Promise<string | null> {
  const trips = await listTrips();
  if (trips.length === 0) return null;
  return `Returning traveller — ${trips.length} past trip${trips.length === 1 ? '' : 's'} on this device.`;
}

/** Gift-a-trip enquiry prefill (item 199): a normal enquiry message
 *  flagged as a gift, with the giver's message card text. No gift
 *  pricing exists — the team confirms the quote on callback, and the
 *  normal pay flow is used afterwards. */
export function giftEnquiryMessage(args: {
  packageName: string;
  giftMessage: string;
  recipientName?: string;
}): string {
  const parts = ['[Gift a trip]'];
  parts.push(`Package: ${args.packageName}`);
  if (args.recipientName !== undefined && args.recipientName.trim() !== '') {
    parts.push(`For: ${args.recipientName.trim()}`);
  }
  parts.push(`Gift message: ${args.giftMessage.trim()}`);
  parts.push('Please share the final quote — this is a gift booking.');
  return parts.join('\n');
}

/** Group-booking enquiry prefill (item 192): asks the team for group
 *  pricing. No slabs exist, so none are stated. */
export function groupEnquiryMessage(args: {
  packageName?: string;
  groupSize: string;
  groupKind: 'school' | 'corporate' | 'family' | 'other';
}): string {
  const parts = ['[Group booking enquiry]'];
  if (args.packageName !== undefined && args.packageName.trim() !== '') {
    parts.push(`Package: ${args.packageName.trim()}`);
  }
  parts.push(`Group type: ${args.groupKind}`);
  parts.push(`Group size (approx.): ${args.groupSize.trim()}`);
  parts.push('Please share group pricing for this trip.');
  return parts.join('\n');
}

/** School/corporate track prefill (item 198): routes into the normal
 *  enquiry flow with a GST-invoicing note. Bulk pricing is "ask team". */
export function corporateEnquiryMessage(args: {
  organisation: string;
  tripKind: 'school' | 'corporate';
  groupSize: string;
  notes: string;
}): string {
  const parts = [
    args.tripKind === 'school'
      ? '[School trip enquiry]'
      : '[Corporate trip enquiry]',
    `Organisation: ${args.organisation.trim()}`,
    `Group size (approx.): ${args.groupSize.trim()}`,
  ];
  if (args.notes.trim() !== '') parts.push(args.notes.trim());
  parts.push('Please share bulk pricing and GST invoicing details.');
  return parts.join('\n');
}
