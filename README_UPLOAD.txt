天道自律傳：諸天無凡人｜v10.1 Excel 自動內容版 GitHub Pages 部署包

上傳方式：解壓縮後，把本資料夾內的所有檔案與資料夾上傳到 GitHub 儲存庫目前發布分支的根目錄，保留 index.html 在最外層，然後 Commit changes。

必要檔案：index.html、css/site.css、js/site.js、js/content-loader.js、js/site-stats.js、js/stats-config.js、TianDao_Website_Content.xlsx、data/site-content.json、tools/excel_to_json.py、.github/workflows/update-site-content.yml、legal/privacy.html、legal/terms.html。

Excel 自動內容：開啟 TianDao_Website_Content.xlsx 修改資料，維持原檔名後上傳到 GitHub 根目錄並 Commit。GitHub Actions 會自動把內容轉成 data/site-content.json，官網數分鐘內更新。第一次使用請閱讀 EXCEL_AUTO_UPDATE_SETUP.txt。

人數統計：首頁已加入「累計造訪人數」與「目前在線人數」。第一次上傳前，請依 FIREBASE_SETUP.txt 完成免費 Firebase 設定；未設定時介面會顯示「統計資料庫尚未啟用」，不會顯示假數字。

目前未放入真正 MP3／MP4；要替換時，把檔案放入 assets/music/theme.mp3 與 assets/video/hero-cinematic.mp4 即可。沒有 MP4 時會自動以 hero-poster.webp 顯示背景；沒有 MP3 時按鈕會提示放入音樂，不會影響頁面操作。

v10.1 互動驗收：保留 v10.0 全部功能；新增 Excel 內容管理、GitHub Actions 自動轉換、安全 JSON 載入與錯誤時保留內建內容；Epic 網址、CNAME、隱私權政策與服務條款均保持不變。
