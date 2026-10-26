# 天道商貿｜參展周邊資料來源治理 V1
更新：2026-10-26｜僅開發分支設計，尚未接入外部 API

## 定位
展覽是唯一主入口。選擇 `trade_events` 中的展覽後，才依城市、場館、地址、展期提供站內參展周邊資訊。不得建立獨立的食衣住行搜尋入口，不提供訂票、訂房、代收款或交易服務。

## 來源准入流程
1. 登錄資料集與官方文件 URL、資料提供者、來源識別碼及用途。
2. **人工確認**授權條款版本、商業再利用、重製/改作、儲存/快取、標示方式、API 使用限制、照片授權與個資影響。
3. 保存審查日期、審查人、證據 URL 或授權檔案參照；未通過不得啟用同步與公開。
4. 通過後才開發 adapter：資料抓取 → schema 驗證 → 去重 → draft → 編輯審核 → published。
5. 定期複查條款與來源有效性；撤銷或變更時停止新增同步並重新評估已發布資料。

## 優先候選（尚未核准）
| 類別 | 候選來源 | 官網 | 審核狀態 |
|---|---|---|---|
| 天氣 | 交通部中央氣象署開放資料 | https://opendata.cwa.gov.tw/ | 待查核個別資料集 |
| 交通 | TDX 運輸資料流通服務 | https://tdx.transportdata.tw/ | 待查核個別 API |
| 住宿 | 交通部觀光署／政府資料開放平台合法旅宿資料 | https://data.gov.tw/ | 待查核資料集 |
| 景點 | 交通部觀光署／地方政府開放資料 | https://data.gov.tw/ | 待查核資料集 |
| 餐飲 | 政府觀光開放資料／商家自願授權 | https://data.gov.tw/ | 待查核資料集 |
| 穿搭 | 天道商貿原創編輯內容＋合規天氣資料 | 站內 | 原創內容待編輯審核 |

候選不等於已取得授權，也不表示 API 已串接。

## 資料來源紀錄欄位
- `source_id`, `category`, `provider_name`, `dataset_name`, `dataset_url`, `terms_url`, `license_name`, `license_version`
- `commercial_use_allowed`, `redistribution_allowed`, `storage_allowed`, `modification_allowed`, `image_rights_verified`：皆為三態（yes/no/unknown），unknown 視為不可公開
- `attribution_text`, `required_attribution_url`, `usage_restrictions`, `api_rate_limit_notes`
- `review_status`: pending / approved / rejected / suspended
- `reviewed_by`, `reviewed_at`, `review_evidence_url`, `last_sync_at`, `last_success_at`, `last_error`

## 每筆展示資料最低欄位
- `event_id`（關聯展覽）、`category`、`title`、`city`、`address`、`source_id`、`source_record_id`
- `source_updated_at`、`source_checked_at`、`official_url`、`publication_status`
- 有時效性資料（天氣、班次、營業時間）須有有效時間範圍；過期或缺少時戳時不標示為即時
- 距離與「附近」必須有可靠場館座標與來源座標；僅有城市不得宣稱步行距離

## 技術安全
- 不更動現有 `trade_events` 313 筆資料，不在正式 Supabase 直接執行未測試 migration。
- 未來資料表與 RLS 先於隔離測試環境驗證；前端僅查詢 `published` 且 `approved` 來源。
- API secret 放伺服器環境變數；不可寫入 GitHub Pages 公開 JS。
- 禁止未經授權抓取 Google Maps 的商家清單、照片、評分、評論。
- 失敗時顯示「來源尚未接入／暫時無法取得」，不以假資料填充。
- 資料來源及查核時間須在站內每筆資料附近可見。

## 階段驗收
1. 本版：建立准入登錄檔與開發文件，不改生產資料庫。
2. 下版：挑選**一個**具明確授權的資料集，核對條款與資料格式。
3. 隔離環境跑通單一資料集：抓取 → 審核 → 站內展覽面板顯示。
4. 確認授權、資料品質與實際畫面後，才考慮正式發布。
