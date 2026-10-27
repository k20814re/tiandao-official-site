/** Offline preview only. Never produces published rows or writes to Supabase. */
import {readFileSync,writeFileSync} from "node:fs";
import {checkManualCandidate} from "./manual-exhibition-gate.ts";
const source=process.argv[2] || "backend/review/plan-b-first-batch-candidates.json";
const destination=process.argv[3];
if(!destination) throw new Error("Output path required: use a local temporary JSON file, NOT a production import.");
const manifest=JSON.parse(readFileSync(source,"utf8"));
if(!Array.isArray(manifest.events)) throw new Error("invalid_manifest");
const records=manifest.events.map((e:Record<string,unknown>,i:number)=>{
 const issues=checkManualCandidate(e as Parameters<typeof checkManualCandidate>[0]);
 const url=typeof e.official_url==="string"?e.official_url:"";
 if(/^https:\/\/www\.tainex\.com\.tw\/event\?/.test(url)) issues.push("E001:generic_event_calendar");
 if(e.evidence_conflict_codes && Array.isArray(e.evidence_conflict_codes) && e.evidence_conflict_codes.length) issues.push("E002:evidence_conflict");
 return {id:`candidate-${i+1}`,title_zh:e.title_zh,starts_at:e.starts_at,ends_at:e.ends_at,city:e.city,venue_name:e.venue_name,address:e.address,official_url:e.official_url,daily_hours_text:e.daily_hours_text,publication_status:"draft",review_blockers:[...new Set(issues)],review_only:true};
});
const payload={format:"tiandao-plan-b-local-review-v1",warning:"REVIEW ONLY: never upload as production records",total:records.length,publishable:0,records};
writeFileSync(destination,JSON.stringify(payload,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({output:destination,total:records.length,blocked:records.filter((x:{review_blockers:string[]})=>x.review_blockers.length>0).length,publishable:0}));
