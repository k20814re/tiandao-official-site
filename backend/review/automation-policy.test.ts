import assert from 'node:assert/strict';
import {moc,evaluate,date,removalDecision} from '../../supabase/functions/exhibition-automation/policy.ts';
const raw={UID:'test1',title:'CI測試展',startDate:'2026/11/01',endDate:'2026/11/03',showInfo:[{location:'臺北市中正區一號',locationName:'CI測試館',time:'2026/11/01 10:00:00',endTime:'2026/11/03 18:00:00'}],masterUnit:['CI單位']};
const p=moc(raw);assert.equal(evaluate(p,p,true).score,95);assert.equal(evaluate(p,p,false).hard_ok,false);assert.ok(evaluate(p,p,false).score<80);
const base={...p,organizer_name:'',daily_hours:[],explicit_url:false};assert.equal(evaluate(base,base,true).score,80);
for(const change of [{title_zh:'異名'},{starts_at:'2026-11-02T00:00:00+08:00'},{venue_name:'另一館'},{external_id:'other'}]){const e=evaluate(p,{...p,...change},true);assert.equal(e.hard_ok,false);assert.ok(e.score<80);}
assert.ok(evaluate(moc({...raw,showInfo:[{location:'未知城市',locationName:'某地'}]}),p,true).score<80);assert.equal(date('2026/02/30'),null);
const c=(at:string,complete=true,detailAbsent=true)=>({at,listAbsent:true,detailAbsent,complete});
assert.equal(removalDecision([c('2026-10-27T00:00:00Z'),c('2026-10-27T06:00:00Z'),c('2026-10-28T00:00:00Z')]).archive,true);
assert.equal(removalDecision([c('2026-10-27T00:00:00Z'),c('2026-10-27T00:01:00Z'),c('2026-10-28T00:00:00Z')]).archive,false);
assert.equal(removalDecision([c('2026-10-27T00:00:00Z'),c('2026-10-27T06:00:00Z',false),c('2026-10-28T00:00:00Z')]).archive,false);
assert.equal(removalDecision([c('2026-10-27T00:00:00Z'),c('2026-10-27T06:00:00Z',true,false),c('2026-10-28T00:00:00Z')]).archive,false);
console.log('Automation 80-point gate, contradictions, dates and conservative removal policy PASS');
