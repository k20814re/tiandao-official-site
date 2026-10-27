import {checkManualCandidate} from "./manual-exhibition-gate.ts";
const base={
 title_zh:"測試展覽",starts_at:"2026-11-01",ends_at:"2026-11-03",
 city:"臺北",venue_name:"測試場館",
 official_url:"https://example.org/events/test-2026",
 source_checked_at:"2026-10-27T00:00:00+08:00",
 source_license_cleared:true,facts_verified:true,
 publication_status:"draft",
};
const assert=(ok:boolean,msg:string)=>{if(!ok)throw Error(msg)};
assert(checkManualCandidate(base).length===0,"valid draft should pass preliminary gate");
const checks=[
 [{...base,official_url:"http://example.org/event"}, "E001"],
 [{...base,official_url:"https://example.org/"}, "E001"],
 [{...base,ends_at:"2026-10-01"}, "E002"],
 [{...base,venue_name:""}, "E003"],
 [{...base,source_license_cleared:false}, "E005"],
 [{...base,source_checked_at:""}, "E011"],
 [{...base,source_checked_at:"2099-01-01T00:00:00Z"}, "E011"],
 [{...base,title_zh:""}, "E012"],
 [{...base,facts_verified:false}, "E010"],
 [{...base,publication_status:"published"}, "E013"],
] as const;
for(const [item,code] of checks){
 assert(checkManualCandidate(item).some(x=>x.startsWith(code+":")),code+" must block");
}
console.log("11 manual candidate gate scenarios passed");
