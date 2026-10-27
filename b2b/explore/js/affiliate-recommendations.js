'use strict';
/** Affiliate recommendations: approved links only; no fabricated tracking IDs.
 * Partners must supply approved destination, disclosure and category.
 * No booking, payment, user profiling, or third-party scripts.
 */
(()=>{
 const allowed=new Set(['food','wear','stay','move','play','leisure']);
 const httpsUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hostname.endsWith('.local')&&!['localhost','127.0.0.1','0.0.0.0'].includes(u.hostname)?u.href:null}catch{return null}};
 // Only a verified Booking.com/CJ partner link may appear in this first release.
 // This checks destination host, NOT commission eligibility or account approval.
 const partnerHostAllowed=(item,url)=>{if(item.partner!=='booking_apac')return false;try{const host=new URL(url).hostname.toLowerCase();return host==='booking.com'||host.endsWith('.booking.com')||host==='cj.com'||host.endsWith('.cj.com')||host==='anrdoezrs.net'||host.endsWith('.anrdoezrs.net')||host==='tkqlhce.com'||host.endsWith('.tkqlhce.com')||host==='jdoqocy.com'||host.endsWith('.jdoqocy.com')||host==='kqzyfj.com'||host.endsWith('.kqzyfj.com')||host==='dpbolvw.net'||host.endsWith('.dpbolvw.net')}catch{return false}};
 const items=Array.isArray(window.TIANDAO_AFFILIATE_LINKS)?window.TIANDAO_AFFILIATE_LINKS:[];
 const root=document.getElementById('affiliate-recommendations');
 if(!root)return;
 const valid=items.filter(x=>x&&allowed.has(x.category)&&typeof x.title==='string'&&x.title.trim().length>1&&x.title.length<=100&&x.approved===true&&httpsUrl(x.url)&&partnerHostAllowed(x,httpsUrl(x.url)));
 if(!valid.length){root.hidden=true;return;}
 const h=document.createElement('h3');h.textContent='參展周邊合作推薦';
 const disclosure=document.createElement('p');disclosure.textContent='廣告／聯盟行銷揭露：以下為合作推薦連結。若您透過連結完成符合條件的交易，本站可能獲得佣金，您仍在第三方平台自行確認價格與條款。本站不代訂或收款。';
 const list=document.createElement('ul');
 for(const item of valid){
  const li=document.createElement('li'),a=document.createElement('a');
  a.href=httpsUrl(item.url);a.textContent=item.title.trim();
  a.target='_blank';a.rel='sponsored nofollow noopener noreferrer';
  li.appendChild(a);list.appendChild(li);
 }
 root.append(h,disclosure,list);root.hidden=false;
})();
