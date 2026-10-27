# 天道商貿｜Resend 測試寄信部署清單（開發環境）

> 目前只提交到 `codex/exhibition-admin-v1`。沒有部署、沒有寄信，也沒有修改正式 Supabase。

## 前置條件
- Resend `tiandaoonline.com` 已顯示 Verified。
- Supabase 專案擁有者確認要部署到**哪一個測試專案**；目前 preview 與 production 共用 Supabase，**禁止直接在現有正式專案試部署**。
- 使用獨立 Supabase staging 專案或經核准的隔離環境。
- 不要將 Resend API Key、測試 token、JWT 放進 GitHub、前端或聊天室。

## Edge Function secrets（只在安全後台輸入）
- `RESEND_API_KEY`: Resend 發信金鑰。
- `RESEND_FROM_ADDRESS`: `天道商貿 <notifications@tiandaoonline.com>`，若供應商不接受顯示名稱，改用 `notifications@tiandaoonline.com`。
- `NOTIFICATION_TEST_TOKEN`: 隨機、不可猜測的高熵測試 token；不可與 API Key 共用。

## 部署要求
1. 僅在隔離的 staging Supabase 專案部署 `supabase/functions/exhibition-notification-smoke/index.ts`。
2. 必須保持 Supabase Edge Function 的 **Verify JWT** 開啟；此端點不實作 JWT 驗證，依賴平台的 JWT 閘道。
3. 以管理員安全環境發出 POST，帶有效 Supabase JWT 和 `x-test-token`，不在瀏覽器公開呼叫。
4. 檢查 Resend 郵件記錄與 Gmail 收件匣。僅成功寄送才可標記 smoke test 通過。
5. 測試完移除或停用此 smoke endpoint，並撤銷測試 token。

## 測試範圍與限制
- 寄信程式固定寄送到 `k20814re@gmail.com`，不接受自訂收件者或郵件內容。
- 固定 idempotency key 防止同一測試意外重複寄信。
- 不操作 `trade_events`、管理員審核狀態或發布權限。
- 不代表 Gmail 收信、回信、MFA、來源授權審查或上架審核已完成。
- 未執行端到端測試前，請勿標示為正式可用。

## 下一階段
以資料庫 outbox 佇列驅動通知；先修正發布權限繞過風險，完成 RLS、服務端核准與 MFA 驗證，再談正式上線。
