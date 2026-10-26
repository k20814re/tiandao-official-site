/**
 * TianDao exhibition anomaly rules. Pure, deterministic, fail-closed.
 * This module does not publish or fetch data. All official evidence must be
 * independently acquired and retained by a licensed backend ingestion process.
 */
export type Evidence = {
  officialEventUrl?: string;
  officialTitle?: string;
  officialStartsAt?: string;
  officialEndsAt?: string;
  officialCity?: string;
  officialVenue?: string;
  officialStatus?: "scheduled" | "postponed" | "cancelled";
  checkedAt?: string;
  sourceTermsApproved?: boolean;
  protectedAssetLicenseApproved?: boolean;
  hasThirdPartyAssets?: boolean;
  linkReachable?: boolean;
};
export type Candidate = {
  title: string;
  startsAt: string;
  endsAt: string;
  city: string;
  venue: string;
  admissionHours?: string;
  ticketPrice?: string;
  duplicateOf?: string;
};
export type Anomaly = {
  code: string;
  severity: "blocker" | "review";
  field: string;
  reason: string;
  expected?: string;
  actual?: string;
  remedy: string;
};
export type Evaluation = {
  status: "blocked" | "review_required" | "eligible_for_human_review";
  publishAllowed: false;
  anomalies: Anomaly[];
};
const norm = (v?: string) => (v || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const validDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
const isOfficialEventUrl = (v?: string) => {
  if (!v) return false;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return false;
    return !["/", "/event", "/events", "/exhibition", "/exhibition/", "/exhibition.aspx"].includes(u.pathname.toLowerCase());
  } catch { return false; }
};
export function evaluateExhibition(candidate: Candidate, evidence: Evidence): Evaluation {
  const anomalies: Anomaly[] = [];
  const add = (code: string, severity: Anomaly["severity"], field: string, reason: string, remedy: string, expected?: string, actual?: string) =>
    anomalies.push({code, severity, field, reason, remedy, ...(expected !== undefined ? {expected} : {}), ...(actual !== undefined ? {actual} : {})});
  if (evidence.sourceTermsApproved !== true)
    add("E005", "blocker", "source_license", "來源使用權限尚未完成核准", "確認來源條款與資料集授權，記錄法律審核依據");
  if (evidence.hasThirdPartyAssets && evidence.protectedAssetLicenseApproved !== true)
    add("E006", "blocker", "assets", "海報、圖片或 LOGO 權利不明", "移除素材或取得可核對的使用授權");
  if (!isOfficialEventUrl(evidence.officialEventUrl))
    add("E001", "blocker", "official_event_url", "缺少可追溯的官方活動專屬網址", "補上主辦或展館的活動專屬頁面；首頁不能視為逐場核實");
  if (evidence.linkReachable === false)
    add("E009", "blocker", "official_event_url", "官方活動連結無法存取", "重新確認網址與官方公告");
  if (!evidence.checkedAt || !Number.isFinite(Date.parse(evidence.checkedAt)))
    add("E011", "blocker", "checked_at", "缺少有效的官方查核時間", "重新查核並保存時間及證據快照");
  if (!norm(candidate.title) || !norm(evidence.officialTitle))
    add("E012", "blocker", "title", "展覽名稱缺少可核對的官方證據", "補上活動名稱的官方證據");
  else if (norm(candidate.title) !== norm(evidence.officialTitle))
    add("E012", "blocker", "title", "展覽名稱與官方資料不一致", "核對官方名稱並修正", evidence.officialTitle, candidate.title);
  if (!validDate(candidate.startsAt) || !validDate(candidate.endsAt) || !validDate(evidence.officialStartsAt) || !validDate(evidence.officialEndsAt) ||
      candidate.startsAt !== evidence.officialStartsAt || candidate.endsAt !== evidence.officialEndsAt || candidate.endsAt < candidate.startsAt)
    add("E002", "blocker", "dates", "展覽日期缺漏、無效或與官方資料不同", "確認展期並修正", `${evidence.officialStartsAt || "?"} ~ ${evidence.officialEndsAt || "?"}`, `${candidate.startsAt} ~ ${candidate.endsAt}`);
  if (!norm(candidate.city) || !norm(candidate.venue) || !norm(evidence.officialCity) || !norm(evidence.officialVenue) ||
      norm(candidate.city) !== norm(evidence.officialCity) || norm(candidate.venue) !== norm(evidence.officialVenue))
    add("E003", "blocker", "venue", "城市或場館缺漏、無效或與官方資料不一致", "確認官方場館及地址並修正", `${evidence.officialCity || "?"} / ${evidence.officialVenue || "?"}`, `${candidate.city} / ${candidate.venue}`);
  if (evidence.officialStatus === "cancelled" || evidence.officialStatus === "postponed")
    add("E004", "blocker", "event_status", "官方已公告取消或延期", "停止發布並依最新官方公告更新資料");
  if (candidate.duplicateOf)
    add("E007", "review", "duplicate", "疑似重複展覽資料", "人工比對來源並合併或標示不同場次", undefined, candidate.duplicateOf);
  if (!candidate.admissionHours || !candidate.ticketPrice)
    add("E008", "review", "admission", "票價或入場時段尚未核實", "未核實欄位只能標示「待確認」，不得填入推測值");
  const blocked = anomalies.some(a => a.severity === "blocker");
  return {status: blocked ? "blocked" : anomalies.length ? "review_required" : "eligible_for_human_review", publishAllowed: false, anomalies};
}
