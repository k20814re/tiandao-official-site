/**
 * Gmail API reader for exhibition review replies.
 * Backend-only. No OAuth token is accepted from a browser.
 * Read-only: never sends, deletes, labels or modifies Gmail messages.
 */
export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
};
export type GmailReply = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  inReplyTo: string;
  references: string;
  messageId: string;
  receivedAtMs: number;
  bodyText: string;
  authenticationResults: string;
};

function header(headers: GmailHeader[] | undefined, name: string): string {
  return (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value?.trim() || "";
}
function plainPart(part: GmailPart | undefined): string | undefined {
  if (!part) return;
  if (part.mimeType?.toLowerCase() === "text/plain" && part.body?.data) return part.body.data;
  for (const p of part.parts || []) {
    const result = plainPart(p);
    if (result) return result;
  }
}
function base64urlToUtf8(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
export function parseGmailReply(message: GmailMessage): GmailReply {
  if (!message.id || !message.threadId || !message.payload || !message.internalDate)
    throw new Error("missing_gmail_message_fields");
  const h = message.payload.headers;
  const rawBody = plainPart(message.payload);
  if (!rawBody) throw new Error("missing_plain_text_reply");
  const receivedAtMs = Number(message.internalDate);
  if (!Number.isSafeInteger(receivedAtMs) || receivedAtMs <= 0)
    throw new Error("invalid_internal_date");
  return {
    id: message.id,
    threadId: message.threadId,
    from: header(h, "From"),
    to: header(h, "To"),
    inReplyTo: header(h, "In-Reply-To"),
    references: header(h, "References"),
    messageId: header(h, "Message-ID"),
    receivedAtMs,
    bodyText: base64urlToUtf8(rawBody),
    authenticationResults: header(h, "Authentication-Results"),
  };
}
/** Only an exact standalone confirmation line is accepted; never parse quoted replies. */
export function extractConfirmationCode(bodyText: string): string | null {
  const first = bodyText.replace(/\r/g, "").split("\n").slice(0, 8);
  const matches = first.map(line => /^CONFIRM\s+([A-Z0-9]{8,24})$/.exec(line.trim())).filter(Boolean);
  return matches.length === 1 ? matches[0]![1] : null;
}
export async function getGmailReply(
  accessToken: string,
  messageId: string,
  fetcher: typeof fetch = fetch,
): Promise<GmailReply> {
  if (!/^[a-zA-Z0-9_-]+$/.test(messageId)) throw new Error("invalid_message_id");
  const response = await fetcher(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`gmail_api_http_${response.status}`);
  return parseGmailReply(await response.json() as GmailMessage);
}
/**
 * IMPORTANT: Authentication-Results is raw evidence, NOT proof of DKIM/DMARC.
 * A trusted server-side verifier must independently establish aligned sender
 * authentication and that headers were added by Google's receiving infrastructure.
 * Do not set authenticatedSender=true merely by string matching this header.
 * OAuth scopes must be approved, least-privilege and server-side only.
 */
