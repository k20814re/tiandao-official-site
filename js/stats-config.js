/*
 * 將 Firebase 控制台提供的 Web App 設定貼到下方，並把 enabled 改成 true。
 * 這些 Web 設定值不是管理員密碼；真正的寫入限制由 Firebase 規則保護。
 */
window.TIANDAO_STATS_CONFIG = {
  enabled: false,
  firebase: {
    apiKey: "PASTE_FIREBASE_API_KEY",
    authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://PASTE_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "PASTE_PROJECT_ID",
    appId: "PASTE_FIREBASE_APP_ID"
  }
};
