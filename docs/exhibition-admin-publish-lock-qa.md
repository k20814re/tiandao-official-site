# 天道商貿｜展覽發布封鎖與回歸測試

狀態：開發分支待驗收；不代表正式站已受保護。

## UI 封鎖
`b2b/admin/exhibitions/admin.js` 禁用編輯表單的 `published` 選項；已發布展覽不可在此草稿編輯器修改。若試圖儲存，顯示 E013，說明必須完成官方證據、授權、Gmail 回信及 MFA 二次驗證。

## 必要測試
1. publisher 開啟草稿：不能選擇「已發布」；可以儲存 draft/review。
2. editor 開啟草稿：不能選擇「已發布」。
3. 任何角色開啟既有 published：不能用草稿編輯器直接覆寫。
4. 修改瀏覽器 DOM、直接呼叫 REST API 或使用舊版前端：**仍必須由資料庫發布鎖拒絕**。
5. 匿名使用者、一般登入、editor、publisher 嘗試 published INSERT/UPDATE 均應遭拒。
6. 既有已發布展覽的公開搜尋不應因 UI 防護而中斷。
7. archive 權限及其審核政策需獨立驗證；封存不等於重新發布。
8. 最終後端發布程序尚未實作，不能將 E013 視為完整 MFA 安全保證。

## 部署依賴
- `backend/migrations/20261027_exhibition_publication_freeze_draft.sql` 只存在於 GitHub，尚未套用。
- 在隔離 staging 完成資料庫 RLS/trigger 測試前，不能將開發版 UI 當成可安全公開的發布後台。
- 目前 preview 與 production 共用 Supabase，禁止未授權變更現有資料庫。
