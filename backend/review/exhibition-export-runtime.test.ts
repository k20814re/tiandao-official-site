import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const src=readFileSync("b2b/explore/js/explore-events.js","utf8");
const csvLine=src.split("\n").find(line=>line.includes("const csv=v=>"));
const csvSource=csvLine&&[null,csvLine.slice(csvLine.indexOf("const csv=v=>")+"const csv=v=>".length).trim().replace(/;$/, "")];
assert.ok(csvSource,"CSV encoder found");
const csv=vm.runInNewContext("(v)=>"+csvSource[1]);
for(const value of ["=1+1","+SUM(1,2)","-3+4","@cmd","\t=1+1","\r\n=1+1"]){
 const result=csv(value);
 assert.ok(result.startsWith('"'),"CSV cell quoted");
 assert.ok(result.includes("'"),"formula-like input neutralized: "+JSON.stringify(value));
}
assert.equal(csv('a"b'),'"a""b"');
const icsLine=src.split("\n").find(line=>line.includes("const escapeIcs=v=>"));
const icsSource=icsLine?.match(/const escapeIcs=v=>(.*);$/);
assert.ok(icsSource,"ICS escaping function found");
const ics=vm.runInNewContext("(v)=>"+icsSource[1]);
assert.equal(ics("a,b;c\\d\nnext"),String.raw`a\,b\;c\\d\nnext`);
const summary=src.match(/function selectedSummary\(x\)\{([\s\S]*?)\n\}/);
assert.ok(summary&&summary[1].includes(".join('\\n')"),"summary uses real line separators");
assert.ok(src.includes("parsed.toISOString().slice(0,10)===v"),"calendar must reject impossible dates");
assert.ok(src.includes("if(!end||end<start)return null"),"calendar must reject reversed ranges");
console.log("Exhibition CSV and ICS runtime encoding checks PASS");
