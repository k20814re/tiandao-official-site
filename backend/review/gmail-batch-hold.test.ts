import assert from 'node:assert/strict';
import {parseBatchHold,batchTag,verifyBatchReply} from './gmail-batch-hold.ts';
const tag='td-review-0123456789abcdef0123456789abcdef';
assert.equal(parseBatchHold('整批保留\n\n> 整批保留，查核通過後發布'),'hold');
assert.equal(parseBatchHold('整批保留，查核通過後發布\n> 原信'),'hold_then_verify');
assert.equal(parseBatchHold('整批保留,查核通過後發布'),'hold_then_verify');
for(const text of ['請先發布\n> 整批保留','這幾筆先保留並先發佈','先保留','> 整批保留','轉寄\n整批保留','整批保留, 查核通過後發布','整批保留\r請發布','']) assert.equal(parseBatchHold(text),null);
for(const s of [tag+' '+tag,'td-review-1234',tag+'f',tag+'-extra','x'+tag]) assert.equal(batchTag(s),null);
assert.equal(batchTag('Re: 通知 '+tag),tag);
const original={id:'aa01',thread_id:'aa01',label_ids:['SENT'],from:['"凱哥" <k20814re@gmail.com>'],to:['k20814re@gmail.com'],
subject:'[天道商貿 自動稽核] 2筆需人工確認｜'+tag,internal_date:'1000000000000',message_id:'<original@example>',plain_text:null};
const reply={...original,id:'bb01',subject:'Re: '+original.subject,internal_date:'1000000001000',message_id:'<reply@example>',
in_reply_to:original.message_id,plain_text:'整批保留，查核通過後發布\n> 引用'};
const now=1000000010000;
assert.equal(verifyBatchReply('k20814re@gmail.com',original,reply,now)?.intent,'hold_then_verify');
for(const change of [
 {label_ids:['INBOX']},{from:['attacker@example.com']},{to:['other@example.com']},
 {from:['k20814re@gmail.com, other@example.com']},{thread_id:'cc01'},{subject:'Re: '+tag+'f'},
 {internal_date:'999999999999'},{internal_date:String(now+400000)},{internal_date:'not-a-date'},
 {plain_text:null},{plain_text:'同意\n整批保留'},{in_reply_to:'<unrelated>'},{id:original.id}
]) assert.equal(verifyBatchReply('k20814re@gmail.com',original,{...reply,...change},now),null);
assert.equal(verifyBatchReply('other@example.com',original,reply,now),null);
assert.equal(verifyBatchReply('k20814re@gmail.com',{...original,to:['other@example.com']},reply,now),null);
assert.equal(verifyBatchReply('k20814re@gmail.com',original,{...reply,in_reply_to:'<other>',references:'<original@example> <other>'},now)?.intent,'hold_then_verify');
console.log('Gmail exact-command, identity, SENT, thread, timestamp and quoted-text guards PASS');
