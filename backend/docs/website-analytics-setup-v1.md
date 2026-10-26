# 天道商貿｜網站流量統計 V1

## 目標
統計商展查詢平台的瀏覽量、訪客數、熱門頁面、來源與概略地區；不得將網站訪問視為訂單或實際參展。

## 已實作（開發分支）
`b2b/explore/index.html` 已預留 Cloudflare Web Analytics 公開站點 token 的設定位置，預設為空，不載入追蹤腳本，也不收集流量。這不是已完成啟用或有報表資料。

## 啟用步驟（由站長操作）
1. 登入 Cloudflare 控制台，開啟 Web Analytics，為測試站建立站點（介面名稱依 Cloudflare 最新版為準）。
2. 取得 Cloudflare Web Analytics beacon 的 **公開站點 token**（通常為 32 位十六進位字元），不要使用 API Token、Global API Key 或其他私密憑證。
3. 在開發分支 `b2b/explore/index.html` 找到 `<meta name="tiandao-cloudflare-analytics-token" content="">`，將 content 設為公開站點 token。
4. 等待 Cloudflare Pages 部署，從測試站瀏覽器確認 beacon 載入、Cloudflare 儀表板收到資料。
5. 正式站要統計時，須另行確認正式站部署及網域設定；**不得直接修改 main**。

## 指標定義
- Page views：頁面載入次數，不等於獨立訪客。
- Visitors：服務商估計的訪客數，不能用來識別個人。
- Top pages / referrers / countries：依 Cloudflare 儀表板實際提供的維度顯示，勿聲稱能得知精確地址。
- Exhibition selections / searches / CSV / ICS：需額外規劃事件追蹤；目前**尚未啟用**，不可宣稱已蒐集。

## 隱私與資安
- 上線前核對 Cloudflare 當前服務條款、資料處理方式、跨境傳輸與台灣個資法適用情況，更新隱私權告知。
- 不將姓名、電子郵件、登入憑證、搜尋全文、完整查詢字串或精確位置當作事件屬性傳送。
- 後台流量報表應限制管理員權限，勿公開網站分析管理憑證。
- 先確認部署方式，避免 Cloudflare Pages 自動分析與手動 beacon 同時啟用造成重複統計。

## 待完成
- 使用者提供或自行填入公開站點 token
- 實際瀏覽器驗證及儀表板數據確認
- 展覽互動事件的匿名、彙總統計設計
- 正式網站上線授權
