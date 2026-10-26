/**
 * Gmail reply verification: PURE POLICY MODULE, not a deployed endpoint.
 *
 * Input MUST be fetched server-side using an authorized Gmail API client.
 * Never accept this object from a browser, inbound webhook body or email From alone.
 * Gmail Authentication-Results must be assessed by a trusted mail verifier.
 * A successful result is an intent only; publishing requires a separate MFA session.
 */
export type ReplyEvidence = {
  gmailMessageId: string;
  gmailThreadId: string;
  fromAddress: string;
  toAddress: string;
  inReplyToMessageId: string;
  authenticatedSender: boolean; // trusted receiver validated DKIM/DMARC alignment
  replyCode: string;
  receivedAtMs: number;
};
export type PendingBatch = {
  batchId: string;
  expectedGmailThreadId: string;
  outboundMessageId: string;
  administratorEmail: string;
  replyCodeHash: string;
  expiresAtMs: number;
  evidenceDigest: string;
  currentEvidenceDigest: string;
  alreadyUsed: boolean;
  blockerCount: number;
};
export type ReplyDecision =
  | { accepted: true; status: "reply_intent_verified"; publish: false }
  | { accepted: false; reason: string; publish: false };

const normalize = (v: string) => v.trim().toLowerCase();
const deny = (reason: string): ReplyDecision => ({ accepted: false, reason, publish: false });

/** hashCode is supplied by the backend; use HMAC-SHA256 with a server secret, not a plain hash. */
export async function verifyGmailReplyIntent(
  mail: ReplyEvidence,
  batch: PendingBatch,
  hashCode: (code: string) => Promise<string>,
  timingSafeEqual: (a: string, b: string) => boolean,
): Promise<ReplyDecision> {
  if (!mail.gmailMessageId || !mail.gmailThreadId || !mail.inReplyToMessageId)
    return deny("missing_gmail_message_identifiers");
  if (!mail.authenticatedSender) return deny("sender_authentication_failed");
  if (normalize(mail.fromAddress) !== normalize(batch.administratorEmail))
    return deny("unexpected_sender");
  if (mail.gmailThreadId !== batch.expectedGmailThreadId)
    return deny("thread_mismatch");
  if (mail.inReplyToMessageId.trim() !== batch.outboundMessageId.trim())
    return deny("reply_not_to_original_notice");
  if (batch.alreadyUsed) return deny("already_used");
  if (mail.receivedAtMs > batch.expiresAtMs || Date.now() > batch.expiresAtMs)
    return deny("expired");
  if (batch.evidenceDigest !== batch.currentEvidenceDigest)
    return deny("candidate_data_changed");
  if (batch.blockerCount > 0) return deny("unresolved_blocker");
  if (!/^[A-Z0-9]{8,24}$/.test(mail.replyCode)) return deny("invalid_code_format");
  const actualHash = await hashCode(mail.replyCode);
  if (!timingSafeEqual(actualHash, batch.replyCodeHash))
    return deny("invalid_reply_code");
  return { accepted: true, status: "reply_intent_verified", publish: false };
}

/**
 * REQUIRED integration controls (not implemented here):
 * 1. Server-only Gmail OAuth token and Gmail API fetch, least-privilege scopes.
 * 2. Verify receiver-trusted DKIM/DMARC results; reject untrusted Authentication-Results.
 * 3. Idempotent Gmail message ID and atomic consume of the batch code in Postgres.
 * 4. Rate limits, audit logs, notification retries and secret rotation.
 * 5. Independent Supabase Auth session + fresh MFA before transactional publication.
 * 6. Revalidate official facts, license, batch digest and all selected item IDs at commit.
 */
