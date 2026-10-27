import type { Anomaly, Candidate, Evaluation } from "./exhibition-anomaly-rules.ts";

/**
 * Build the administrator notification payload from evaluated evidence.
 * Never sends mail and never grants publication rights.
 * All links are rendered as plain text, not untrusted HTML.
 */
export type Notification = {
  to: string;
  subject: string;
  text: string;
  blockedCount: number;
  reviewCount: number;
};
export type ReviewEntry = {
  id: string;
  candidate: Candidate;
  evaluation: Evaluation;
  sourceUrl?: string;
  checkedAt?: string;
};
export const ADMIN_REVIEW_EMAIL = "k20814re@gmail.com";
const clean = (value: string | undefined, max = 500) =>
  (value || "未提供").replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);
function explain(anomaly: Anomaly): string {
  const lines = [
    `  [${anomaly.code}] ${anomaly.severity === "blocker" ? "禁止發布" : "需要人工複核"}｜${clean(anomaly.field)}`,
    `  原因：${clean(anomaly.reason)}`,
  ];
  if (anomaly.expected !== undefined) lines.push(`  官方：${clean(anomaly.expected)}`);
  if (anomaly.actual !== undefined) lines.push(`  候選：${clean(anomaly.actual)}`);
  lines.push(`  處理：${clean(anomaly.remedy)}`);
  return lines.join("\n");
}
export function buildAnomalyNotification(batchId: string, entries: ReviewEntry[], adminUrl: string): Notification {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) throw new Error("invalid_batch_id");
  const url = new URL(adminUrl);
  if (url.protocol !== "https:" || !url.pathname.startsWith("/b2b/admin/"))
    throw new Error("invalid_admin_url");
  if (!entries.length) throw new Error("empty_batch");
  if (entries.length > 100) throw new Error("batch_too_large");
  const blockedCount = entries.filter(e => e.evaluation.status === "blocked").length;
  const reviewCount = entries.length - blockedCount;
  const sections = entries.map((entry, index) => {
    const { candidate, evaluation } = entry;
    return [
      `${index + 1}. ${clean(candidate.title, 120)} [${clean(entry.id, 80)}]`,
      `狀態：${evaluation.status === "blocked" ? "禁止發布" : evaluation.status === "review_required" ? "需人工複核" : "待管理員核准"}`,
      `展期：${clean(candidate.startsAt)} ～ ${clean(candidate.endsAt)}`,
      `地點：${clean(candidate.city)} / ${clean(candidate.venue)}`,
      `證據來源：${clean(entry.sourceUrl, 400)}`,
      `查核時間：${clean(entry.checkedAt)}`,
      ...(evaluation.anomalies.length ? evaluation.anomalies.map(explain) : ["未偵測異常；仍需管理員核准"]),
    ].join("\n");
  });
  return {
    to: ADMIN_REVIEW_EMAIL,
    subject: `[天道商貿] 展覽審核待辦：阻擋 ${blockedCount}／複核 ${reviewCount}｜批次 ${batchId}`,
    text: [
      "天道商貿｜展覽資料異常與審核通知",
      `批次：${batchId}`,
      `禁止發布：${blockedCount} 筆；待複核／待核准：${reviewCount} 筆`,
      "注意：本信僅供查核，不代表資料已核准或發布。",
      ...sections,
      `管理後台：${url.toString()}`,
      "請登入後台逐筆勾選。嚴重異常不可強制通過；回覆郵件僅代表確認意向，仍須二次身分驗證。",
      "如非本人操作，請勿回覆或核准。",
    ].join("\n\n"),
    blockedCount,
    reviewCount,
  };
}
