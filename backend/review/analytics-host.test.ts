import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('b2b/explore/index.html','utf8');
const token=html.match(/name="tiandao-cloudflare-analytics-token" content="([a-f0-9]{32})"/)?.[1];
assert.equal(token,'1bc011f45a4b4e9ab0f36963e4c43844');
const script=html.match(/<script>\s*(\/\* Optional Cloudflare Web Analytics[\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
for(const host of ['tiandaoonline.com','www.tiandaoonline.com','preview.pages.dev','localhost','eviltiandaoonline.com','tiandaoonline.com.evil.example']){
 const loaded:any[]=[];
 const document={querySelector:()=>({content:token}),createElement:()=>({setAttribute(name:string,value:string){this[name]=value}}),head:{appendChild:(node:any)=>loaded.push(node)}};
 vm.runInNewContext(script,{window:{location:{hostname:host}},document});
 assert.equal(loaded.length,['tiandaoonline.com','www.tiandaoonline.com'].includes(host)?1:0);
 if(loaded.length){assert.equal(loaded[0].src,'https://static.cloudflareinsights.com/beacon.min.js');assert.equal(JSON.parse(loaded[0]['data-cf-beacon']).token,token);}
}
console.log('Existing Cloudflare token preserved; preview hosts do not load analytics PASS');
