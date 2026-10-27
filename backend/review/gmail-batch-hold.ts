/** Interpret only the first non-empty line. Never search quoted or forwarded text. */
export function parseBatchHold(body: string): 'hold' | 'hold_then_verify' | null {
  if (typeof body !== 'string' || body.length > 100_000) return null;
  const value = body.replace(/\r\n/g, '\n').split('\n').find(line => line.trim())?.trim();
  if (value === '整批保留') return 'hold';
  if (value === '整批保留，查核通過後發布' || value === '整批保留,查核通過後發布') return 'hold_then_verify';
  return null;
}
export function batchTag(subject: string): string | null {
  const tags = subject.match(/(?<![a-zA-Z0-9_-])td-review-[a-f0-9]{32}(?![a-zA-Z0-9_-])/g) || [];
  return tags.length === 1 ? tags[0] : null;
}
type Message = { id: string; thread_id: string; label_ids: string[]; from: string[]; to: string[];
  subject: string; internal_date: string; message_id: string; in_reply_to?: string; references?: string;
  plain_text: string | null };
function self(addresses: string[]) {
  if (addresses.length !== 1 || /[,;\r\n]/.test(addresses[0])) return false;
  const value = addresses[0].trim().toLowerCase();
  return value === 'k20814re@gmail.com' || /^[^<>]*<k20814re@gmail\.com>$/.test(value);
}
/** Inputs must be direct Gmail tool output, never identity claims inside an email. */
export function verifyBatchReply(profile: string, original: Message, reply: Message, nowMs: number) {
  if (profile !== 'k20814re@gmail.com') return null;
  if (!/^[0-9a-f]{1,64}$/.test(original.id) || !/^[0-9a-f]{1,64}$/.test(reply.id)
    || !/^[0-9a-f]{1,64}$/.test(reply.thread_id) || original.id === reply.id) return null;
  if (!original.label_ids.includes('SENT') || !reply.label_ids.includes('SENT')
    || !self(original.from) || !self(original.to) || !self(reply.from) || !self(reply.to)) return null;
  if (original.thread_id !== reply.thread_id || !original.subject.startsWith('[天道商貿 自動稽核]')) return null;
  const tag = batchTag(original.subject);
  if (!tag || tag !== batchTag(reply.subject)) return null;
  if (!original.message_id || !(reply.in_reply_to === original.message_id
    || (reply.references || '').split(/\s+/).includes(original.message_id))) return null;
  const at = Number(reply.internal_date), sent = Number(original.internal_date);
  if (!/^\d+$/.test(reply.internal_date) || !/^\d+$/.test(original.internal_date)
    || !Number.isFinite(nowMs) || at <= sent || at > nowMs + 300_000 || at < nowMs - 7 * 86400_000) return null;
  const intent = reply.plain_text === null ? null : parseBatchHold(reply.plain_text);
  if (!intent) return null;
  return {original_message_id: original.id, reply_message_id: reply.id, thread_id: reply.thread_id,
    batch_tag: tag, reply_at: new Date(at).toISOString(), intent,
    command: intent === 'hold' ? '整批保留' : '整批保留，查核通過後發布'};
}
