import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const config=readFileSync("b2b/explore/js/affiliate-config.js","utf8");
const script=readFileSync("b2b/explore/js/affiliate-recommendations.js","utf8");
const html=readFileSync("b2b/explore/index.html","utf8");
assert.ok(html.indexOf('js/affiliate-config.js')<html.indexOf('js/affiliate-recommendations.js'));
assert.ok(html.includes('id="affiliate-recommendations"'));
function run(items){
 const nodes=[];
 const root={hidden:false,append(...parts){nodes.push(...parts);}};
 const document={
  getElementById:()=>root,
  createElement(tag){return {tag,children:[],appendChild(child){this.children.push(child);}};}
 };
 const sandbox={window:{TIANDAO_AFFILIATE_LINKS:items},document,URL};
 vm.runInNewContext(script,sandbox);
 return {root,nodes};
}
const empty={window:{},document:{getElementById:()=>({hidden:false,append(){throw Error("unexpected render")}})}};
vm.runInNewContext(config,empty);
assert.equal(empty.window.TIANDAO_AFFILIATE_LINKS.length,0);
assert.equal(run([]).root.hidden,true);
const base={partner:"booking_apac",category:"stay",title:"住宿推薦",approved:true};
for(const url of [
 "javascript:alert(1)","http://www.anrdoezrs.net/click","https://evil.example/offer",
 "https://anrdoezrs.net.evil.example/click","https://booking.com/hotel",
 "https://cj.com","https://localhost/","https://anrdoezrs.net:8080/click"
]){
 assert.equal(run([{...base,url}]).root.hidden,true,url);
}
assert.equal(run([{...base,url:"https://www.anrdoezrs.net/click",approved:false}]).root.hidden,true);
assert.equal(run([{...base,url:"https://www.anrdoezrs.net/click",category:"food"}]).root.hidden,true);
const valid=run([{...base,url:"https://www.anrdoezrs.net/click"}]);
assert.equal(valid.root.hidden,false);
assert.equal(valid.nodes[2].children[0].children[0].rel,"sponsored nofollow noopener noreferrer");
assert.equal(valid.nodes[2].children[0].children[0].target,"_blank");
assert.ok(valid.nodes[1].textContent.includes("聯盟行銷揭露"));
console.log("Booking CJ affiliate URL and disclosure checks PASS");
