"use strict";
(()=>{
const BASE="https://ibvmfmgikraatiobpmmz.supabase.co";
const KEY="sb_publishable_nJ8cX-FtOkbzfgdz8Z2IJA_tcg58qfE";
const $=id=>document.getElementById(id);
const form=$("login"),panel=$("panel"),status=$("status"),submit=$("submit");
let token=null;
function clear(){token=null;$("password").value="";panel.hidden=true;form.hidden=false;$("identity").textContent="";$("review-list").replaceChildren();}
async function request(path,options={}){
 const response=await fetch(BASE+path,{...options,headers:{"apikey":KEY,"Content-Type":"application/json",...(token?{"Authorization":"Bearer "+token}:{}),...(options.headers||{})},cache:"no-store"});
 if(!response.ok)throw Error("身分驗證或權限檢查失敗（HTTP "+response.status+"）");
 return response.json();
}
form.addEventListener("submit",async event=>{
 event.preventDefault();const email=$("email").value.trim(),password=$("password").value;clear();submit.disabled=true;status.textContent="正在驗證帳號與管理員角色…";
 try{
  const auth=await request("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
  if(!auth.access_token||!auth.user?.id)throw Error("登入回應不完整");
  token=auth.access_token;
  const profiles=await request("/rest/v1/exhibition_admin_profiles?select=user_id,role&user_id=eq."+encodeURIComponent(auth.user.id)+"&limit=1");
  const profile=Array.isArray(profiles)?profiles[0]:null;
  if(!profile||profile.user_id!==auth.user.id||!["editor","publisher"].includes(profile.role))throw Error("此帳號沒有管理員權限");
  $("identity").textContent="已驗證角色："+(profile.role==="publisher"?"發布管理員":"內容編輯")+"（"+auth.user.email+"）";
  form.hidden=true;panel.hidden=false;status.textContent="已通過登入與角色檢查（唯讀）。";
 }catch(err){clear();status.textContent=err instanceof Error?err.message:"登入失敗"}
 finally{submit.disabled=false}
});
$("load-events").addEventListener("click",async()=>{
 const list=$("review-list");list.replaceChildren();
 if(!token||panel.hidden){status.textContent="請先登入管理員。";return;}
 const currentToken=token;status.textContent="正在讀取待審核展覽…";
 try{
  const rows=await request("/rest/v1/trade_events?select=id,title_zh,publication_status,starts_at,city&publication_status=in.(draft,review)&order=starts_at.asc&limit=30");
  if(currentToken!==token||panel.hidden)return;
  if(!Array.isArray(rows))throw Error("資料格式錯誤");
  const heading=document.createElement("p");heading.textContent="待審核展覽（最多 30 筆，唯讀）："+rows.length;list.append(heading);
  for(const item of rows){
   const row=document.createElement("p");
   row.textContent=[item.title_zh||"未命名",item.city||"地點待確認",item.starts_at||"日期待確認",item.publication_status].join("｜");
   list.append(row);
  }
  status.textContent="已讀取待審核清單，沒有修改資料。";
 }catch(err){if(currentToken!==token)return;list.replaceChildren();status.textContent=err instanceof Error?err.message:"清單讀取失敗"}
});
$("logout").addEventListener("click",async()=>{
 const old=token;clear();status.textContent="已登出本頁。";
 if(old)try{await fetch(BASE+"/auth/v1/logout",{method:"POST",headers:{"apikey":KEY,"Authorization":"Bearer "+old}})}catch{}
});
window.addEventListener("pagehide",clear);
})();
