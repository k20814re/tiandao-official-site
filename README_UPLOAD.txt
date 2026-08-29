天道自律傳：諸天無凡人｜v10.3 全內容 Excel 自動版 GitHub Pages 部署包

上傳方式：解壓縮後，把本資料夾內的所有檔案與資料夾上傳到 GitHub 儲存庫目前發布分支的根目錄，保留 index.html 在最外層，然後 Commit changes。

必要檔案：index.html、css/site.css、js/site.js、js/content-loader.js、js/site-stats.js、js/stats-config.js、TianDao_Website_Content.xlsx、data/site-content.json、tools/excel_to_json.py、.github/workflows/update-site-content.yml、legal/privacy.html、legal/terms.html。

Excel 自動內容：開啟 TianDao_Website_Content.xlsx 修改資料，維持原檔名後上傳到 GitHub 根目錄並 Commit。除原有內容表外，新增網站文字、網站素材、遊戲特色、App 標籤、畫廊內容與社群圖示路徑；GitHub Actions 會自動把內容轉成 data/site-content.json，官網數分鐘內更新。第一次使用請閱讀 EXCEL_AUTO_UPDATE_SETUP.txt。

人數統計：首頁已加入「累計造訪人數」與「目前在線人數」。第一次上傳前，請依 FIREBASE_SETUP.txt 完成免費 Firebase 設定；未設定時介面會顯示「統計資料庫尚未啟用」，不會顯示假數字。

網站素材：Excel 會控制背景圖片、背景影片、預告影片、畫廊圖片、App 圖示、工作室圖片、網站圖示與背景音樂的路徑；實際檔案仍要放在 GitHub 的 assets 資料夾。沒有背景影片時會使用海報圖，預告影片留空時會顯示製作中畫面。

v10.3 互動驗收：保留既有功能；新增首頁文字、世界觀、圖片、影片、音樂、畫廊、App 素材與社群圖示的 Excel 控制、GitHub Actions 自動轉換、安全 JSON 載入與錯誤時保留內建內容；Epic／EOS 連結、CNAME、隱私權政策與服務條款均保持不變。
