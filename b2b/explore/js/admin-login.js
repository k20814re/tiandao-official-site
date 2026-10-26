"use strict";
(()=>{
const BASE="https://ibvmfmgikraatiobpmmz.supabase.co";
const KEY="sb_publishable_nJ8cX-FtOkbzfgdz8Z2IJA_tcg58qfE";
const $=id=>document.getElementById(id);
const form=$("login"),panel=$("panel"),status=$("status"),submit=$("submit");
let token=null;
function clear(){token=null;$("password").value="";panel.hidden=true;form.hidden=false;$("identity").textContent="";}
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
$("logout").addEventListener("click",async()=>{
 const old=token;clear();status.textContent="已登出本頁。";
 if(old)try{await fetch(BASE+"/auth/v1/logout",{method:"POST",headers:{"apikey":KEY,"Authorization":"Bearer "+old}})}catch{}
});
window.addEventListener("pagehide",clear);
})();
