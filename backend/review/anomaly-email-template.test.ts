import { evaluateExhibition } from "./exhibition-anomaly-rules.ts";
import { buildAnomalyNotification } from "./anomaly-email-template.ts";
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const candidate = { title:"測試展覽", startsAt:"2026-11-13", endsAt:"2026-11-16", city:"臺北", venue:"南港展覽館" };
const evidence = {
 officialEventUrl:"https://example.org/events/test-2026", officialTitle:"測試展覽",
 officialStartsAt:"2026-11-20", officialEndsAt:"2026-11-23", officialCity:"臺北",
 officialVenue:"南港展覽館", checkedAt:"2026-10-27T12:00:00+08:00",
 sourceTermsApproved:false, linkReachable:true,
};
const evaluation = evaluateExhibition(candidate, evidence);
const notification = buildAnomalyNotification("11111111-1111-4111-8111-111111111111",
 [{id:"candidate-1",candidate,evaluation,sourceUrl:evidence.officialEventUrl,checkedAt:evidence.checkedAt}],
 "https://tiandao-b2b-preview.pages.dev/b2b/admin/exhibitions/");
assert(notification.to==="k20814re@gmail.com","recipient mismatch");
assert(notification.blockedCount===1,"must count blockers");
assert(notification.text.includes("E002") && notification.text.includes("E005"),"must explain date and licensing anomalies");
assert(notification.text.includes("2026-11-20"),"must include official date evidence");
assert(notification.text.includes("禁止發布"),"must explicitly prohibit publication");
assert(!notification.text.includes("<script"),"text-only output expected");
console.log("6 notification assertions passed");
