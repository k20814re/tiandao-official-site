# 天道商貿｜展覽資料自動化品質閘門 v1

狀態：開發規範，未授權自動上線或變更正式資料庫。

## 流程
來源登錄 → 授權審核 → 合規方式擷取 → 候選資料 → 官方頁核對 → 去重及衝突偵測 → 人工審核 → 發布 → 定期複核。

## 硬性規則
1. 預設拒絕：任何未列入 allowlist 的來源不可啟動擷取；robots.txt 不是著作權授權。
2. 優先使用具明確授權的 API / 開放資料；政府資料逐資料集確認授權版本與署名義務。
3. 未取得明確權利或適當法律依據，不抓取、保存、展示他人的海報、照片、LOGO、完整文案。
4. 活動必須有可追溯的主辦／展館官方活動頁或等效官方紀錄；首頁或通用檔期頁不等於已逐場驗證。
5. 名稱、日期、城市、場館必須可被證據支持。缺少任何一項或出現矛盾，一律 quarantine。
6. 票價、開放時段、報名限制未核實則顯示「待確認」，不得推測；不得將其寫為官方已確認。
7. 跨來源去重：正規化名稱、展期、場館，保留每筆來源證據與衝突歷史。
8. 取消、延期、改場地、官方頁失效、授權異動 → 立即撤回自動發布資格，交人工複核。
9. 法務核准與資料事實核准是兩道獨立關卡，兩者皆通過才可發布。
10. 預設只產生 draft/review，不寫 published；發布需經明確核准，保留操作者、時間、證據。
11. 定期檢查頻率應受來源條款與 rate limits 約束；失敗不可自動視為「仍有效」。
12. 前端不可將 curated / draft / review 顯示成「已發布」或「已核實」。

## 每筆資料最少證據
source_id, source_url, official_event_url, source_license, license_reviewed_at, title, starts_at, ends_at, city, venue_name, source_checked_at, evidence_fields, verification_status, reviewer, reviewed_at, last_change_hash, conflict_notes。

## 狀態機
discovered → source_permitted → extracted → pending_verification → verified_facts → approved_for_publication → published。
任何失敗 → quarantined；來源撤銷 → withdrawn。不可跳過授權與證據關卡。

## 現況阻塞
既有約40筆人工資料缺逐場官方活動專頁，應視為待核實；在完成查核前不可作為正式發布依據。
開發分支目前仍在前端直接展示人工資料，與本品質閘門不符，需優先改為預設不公開未核實候選。
Supabase production 與 main 未經核准不得更動。
