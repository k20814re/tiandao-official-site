/**
 * Pure authorization preflight for a FUTURE backend-only publication RPC.
 * This is deliberately not an endpoint, does not write to a database, and
 * NEVER returns a token/capability that can bypass the publication freeze.
 * Caller MUST load facts from trusted server-side records and revalidate
 * within the same DB transaction that publishes selected events.
 */
export type PublishItem = {
  id: string;
  selected: boolean;
  decision: "approved" | "pending" | "rejected" | "recheck";
  severity: "blocker" | "review" | "info";
  factVerified: boolean;
  licenseApproved: boolean;
  officialEventUrl: string | null;
  checkedAt: string | null;
  evidenceDigest: string;
  currentEvidenceDigest: string;
  cancelledOrPostponed: boolean;
};
export type PublishContext = {
  authenticatedAdmin: boolean;
  role: "publisher" | "editor" | "none";
  freshMfaVerified: boolean;
  gmailIntentVerified: boolean;
  gmailIntentConsumed: boolean;
  challengeExpired: boolean;
  challengeUsed: boolean;
  batchExpired: boolean;
  batchEvidenceDigest: string;
  currentBatchEvidenceDigest: string;
  selectedIds: string[];
  items: PublishItem[];
};
export type PublishPreflight = {eligible: false; reasons: string[]} | {eligible: true; reasons: []};
const validUrl = (v: string | null) => {
  if (!v) return false;
  try {const u=new URL(v); return u.protocol==="https:" && !!u.hostname && u.pathname!=="/";}
  catch {return false;}
};
export function preflightPublication(context: PublishContext): PublishPreflight {
  const reasons:string[]=[];
  if (!context.authenticatedAdmin || context.role!=="publisher") reasons.push("publisher_auth_required");
  if (!context.freshMfaVerified) reasons.push("fresh_mfa_required");
  if (!context.gmailIntentVerified || context.gmailIntentConsumed) reasons.push("unconsumed_gmail_intent_required");
  if (context.challengeExpired || context.challengeUsed || context.batchExpired) reasons.push("expired_or_used_confirmation");
  if (!context.batchEvidenceDigest || context.batchEvidenceDigest!==context.currentBatchEvidenceDigest)
    reasons.push("batch_evidence_changed");
  const ids=context.selectedIds;
  if (!ids.length || new Set(ids).size!==ids.length) reasons.push("invalid_selection");
  const selected=context.items.filter(i=>i.selected);
  if (selected.length!==ids.length || selected.some(i=>!ids.includes(i.id)) || ids.some(id=>!selected.some(i=>i.id===id)))
    reasons.push("selection_mismatch");
  for(const item of selected){
    const prefix=`item:${item.id}:`;
    if(item.decision!=="approved") reasons.push(prefix+"not_approved");
    if(item.severity==="blocker") reasons.push(prefix+"unresolved_blocker");
    if(!item.factVerified) reasons.push(prefix+"facts_not_verified");
    if(!item.licenseApproved) reasons.push(prefix+"license_not_approved");
    if(!validUrl(item.officialEventUrl)) reasons.push(prefix+"official_event_url_missing");
    if(!item.checkedAt || !Number.isFinite(Date.parse(item.checkedAt))) reasons.push(prefix+"evidence_timestamp_missing");
    if(!item.evidenceDigest || item.evidenceDigest!==item.currentEvidenceDigest) reasons.push(prefix+"evidence_changed");
    if(item.cancelledOrPostponed) reasons.push(prefix+"event_cancelled_or_postponed");
  }
  return reasons.length?{eligible:false,reasons}:{eligible:true,reasons:[]};
}
