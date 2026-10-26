/**
 * Manual fast-launch gate (Plan B).
 * Run with Node 22: node --experimental-strip-types backend/review/manual-exhibition-gate.test.ts
 * No DB writes, API keys, or network calls.
 */
export type ManualCandidate = {
 title_zh:string; starts_at:string; ends_at:string; city:string;
 venue_name:string; official_url:string; source_checked_at:string;
 source_license_cleared:boolean; facts_verified:boolean;
 publication_status?:string;
};
const HTTPS=/^https:\/\//i;
export function checkManualCandidate(x:ManualCandidate):string[]{
 const issues:string[]=[];
 if(!x.title_zh?.trim())issues.push("E012:title_missing");
 if(!x.city?.trim()||!x.venue_name?.trim())issues.push("E003:venue_or_city_missing");
 const start=Date.parse(x.starts_at),end=Date.parse(x.ends_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)issues.push("E002:invalid_date_range");
 let url:URL|null=null;
 try{url=new URL(x.official_url)}catch{}
 if(!url||!HTTPS.test(x.official_url)||!url.hostname.includes(".")||url.username||url.password)
  issues.push("E001:official_event_url_invalid");
 if(!x.source_checked_at||!Number.isFinite(Date.parse(x.source_checked_at)))issues.push("E011:source_check_missing");
 if(x.source_license_cleared!==true)issues.push("E005:source_license_not_cleared");
 if(x.facts_verified!==true)issues.push("E010:official_facts_not_verified");
 if(x.publication_status==="published")issues.push("E013:manual_direct_publish_forbidden");
 return issues;
}
// Passing this preliminary data-quality check does NOT authorize publication.
// Server-side evidence verification, permissions and an approved publishing
// mechanism are still mandatory; never trust booleans submitted by a browser.
