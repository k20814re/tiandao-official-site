/** A project: conservative ingestion policy. This is a pre-ingestion gate, not legal advice.
 * Unknown source rights MUST be manually reviewed. Never bypass paywalls, logins,
 * robots restrictions, CAPTCHAs, or website terms. Do not ingest personal data.
 */
export type SourcePolicy = {
  sourceUrl:string;
  method:"official_api"|"licensed_feed"|"public_page"|"manual";
  rights:"explicitly_permitted"|"unknown"|"prohibited";
  termsPermitAutomatedAccess:boolean;
  robotsPermitAccess:boolean;
  requiresLogin:boolean;
  containsPersonalData:boolean;
  officialSource:boolean;
  attributionRequired:boolean;
  attributionProvided:boolean;
  checkedAt:string|null;
};
export type IngestionDecision={allowed:boolean; reasons:string[]};
export function checkIngestionPolicy(p:SourcePolicy):IngestionDecision {
 const reasons:string[]=[];
 let u:URL|null=null;
 try {u=new URL(p.sourceUrl);} catch {reasons.push("invalid_source_url");}
 if(!u || u.protocol!=="https:" || !u.hostname || u.username || u.password)
   reasons.push("unsafe_source_url");
 if(p.rights!=="explicitly_permitted") reasons.push(p.rights==="prohibited"?"rights_prohibited":"rights_unverified");
 if(!p.termsPermitAutomatedAccess) reasons.push("terms_not_permitted");
 if(!p.robotsPermitAccess) reasons.push("robots_not_permitted");
 if(p.requiresLogin) reasons.push("login_required");
 if(p.containsPersonalData) reasons.push("personal_data_requires_separate_review");
 if(p.attributionRequired && !p.attributionProvided) reasons.push("attribution_missing");
 if(!p.checkedAt || !Number.isFinite(Date.parse(p.checkedAt))) reasons.push("source_review_missing");
 if(p.method==="official_api" && !p.officialSource) reasons.push("not_official_api");
 // The policy gate does not fetch pages or inspect content. Human/legal review
 // remains required for ambiguous permissions and any expanded data use.
 return {allowed:reasons.length===0,reasons};
}
