# 展覽後台獨立測試部署與驗收（不修改正式站）

## 目前狀態
- 程式分支：`codex/exhibition-admin-v1`；正式 `main` 不合併、不部署。
- Supabase 正式資料庫已有 `trade_events`、`exhibition_admin_profiles`，分類欄位 `exhibition_category`、`source_checked_at` 已由管理者執行 SQL 新增。
- 此測試使用**同一個 Supabase 專案**，因此「測試站」**不等於測試資料庫**。登入後先只做讀取驗收；新增、編輯、封存、同步、匯入、發布都會更動正式資料，未另建 staging DB 前不得操作。

## 建立獨立測試網址
建議 Cloudflare Pages（或其他支援靜態站的獨立測試主機）：
1. 新建 Pages 專案，連結 GitHub `k20814re/tiandao-official-site`。
2. 將 Production branch 設為 `codex/exhibition-admin-v1`（僅此**新建測試專案**，不要改動現有正式網站的部署設定）。
3. 靜態網站：Build command 留空；Build output directory 使用 `/`（專案根目錄；若平台不接受 `/`，依介面改為 `.`）。
4. 部署後使用新產生的 `*.pages.dev` 網址，開啟 `/b2b/admin/exhibitions/`。**不要把 tiandaoonline.com 綁到此測試專案**。
5. 若要測試密碼重設，須先在 Supabase Authentication → URL Configuration 的 Redirect URLs 加入**精確測試站回呼網址**；正常電子郵件／密碼登入不需要先改 Redirect URLs。

## 唯讀驗收（不修改資料）
1. 開啟測試站 `/b2b/admin/exhibitions/`，應看到登入表單，而非「後台設定未載入」。
2. 使用已配置 `publisher` 的 Supabase Auth 帳號登入；應顯示帳號與 `publisher` 角色。
3. 確認「全部／草稿／已封存／已發布」數字與 SQL 查詢相符（資料可能隨同步變動）。
4. 以「未分類」篩選，應顯示尚未人工分類的資料；分類標籤不代表自動驗證。
5. 測試搜尋、狀態、來源、分類及「商展候選」關鍵字初篩；**不要點選同步、批次匯入、儲存或封存**。
6. 使用瀏覽器開發者工具 Network 檢查 `trade_events`、`trade_event_sources` API：應為 200；若 401/403，檢查 Auth session 和 RLS；若 400，檢查資料庫欄位與 API 查詢參數。
7. 登出後，應回到登入表單。

## 安全界線
- `sb_publishable_...` 是公開金鑰，RLS 仍是存取保護的關鍵；絕不把 `service_role` 或密碼寫進前端。
- 現有資料庫的 `prepare_trade_event` trigger 仍包含 `review` 字串；正式狀態 CHECK 僅允許 `draft`、`published`、`archived`。正式資料寫入驗收前須另行確認 trigger、RLS 與狀態轉換規則，不要直接套用舊 migration。
- 測試站不應公開分享管理員帳密；完成後可移除測試站或加上 Cloudflare Access。
- 本文件是部署與測試指引，**不代表已部署或已通過登入測試**。
