/** Syntax-only check of the offline review preview inline JavaScript. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const html=readFileSync("b2b/explore/review-preview.html","utf8");
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert(scripts.length>0,"preview page must contain a script");
for(const [index,match] of scripts.entries())new Script(match[1],{filename:"review-preview-inline-"+index+".js"});
assert(html.includes('data.publishable!==0'),"preview must reject publishable input");
assert(html.includes('publication_status!=="draft"'),"preview must reject published records");
console.log("Review preview inline JavaScript syntax PASS");
