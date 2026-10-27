import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const script=readFileSync("b2b/explore/js/explore-events.js","utf8");
const total=Number(process.env.EXHIBITION_TEST_ROWS||501);
const rows=Array.from({length:total},(_,i)=>({id:String(i+1),title_zh:"測試展覽"+i,city:"臺中市",starts_at:"2027-01-01",ends_at:"2027-01-03",exhibition_category:"b2b_trade_show"}));
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{id,innerHTML:"",textContent:"",addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},scrollIntoView(){}});return nodes.get(id)}
const calls=[];
const context={window:{URL,location:{href:"https://example.test/b2b/explore/"}},URL,document:{getElementById:node,querySelectorAll(){return[]},querySelector(){return null}},FormData:class{get(){return""}},Intl,Date,console,fetch:async url=>{
 const u=new URL(url);calls.push(u);
 assert.equal(u.searchParams.get("publication_status"),"eq.published");
 assert.equal(u.searchParams.get("deleted_at"),"is.null");
 assert.equal(u.searchParams.get("order"),"starts_at.asc,id.asc");
 const offset=Number(u.searchParams.get("offset"));
 return {ok:true,json:async()=>rows.slice(offset,offset+Number(u.searchParams.get("limit")))};
}};
vm.runInNewContext(script,context);
for(let i=0;i<100&&!node("event-results").innerHTML.includes("載入資料共 "+total+" 筆");i++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(calls.length,Math.floor(total/500)+1,"page count including exact-cap probe");
assert.equal(calls[0].searchParams.get("offset"),"0");
assert.equal(calls[1].searchParams.get("offset"),"500");
assert.ok(node("event-results").innerHTML.includes("載入資料共 "+total+" 筆"));
assert.ok(node("event-results").innerHTML.includes("第 1 / "+Math.ceil(total/10)+" 頁"));
assert.ok(!node("event-results").innerHTML.includes("目前無法載入"));
console.log("Exhibition mocked "+total+"-row paginated load PASS");
