/*
 * 將 Firebase 控制台提供的 Web App 設定貼到下方，並把 enabled 改成 true。
 * 這些 Web 設定值不是管理員密碼；真正的寫入限制由 Firebase 規則保護。
 */
window.TIANDAO_STATS_CONFIG = {
  enabled: true,
  firebase: {
    apiKey: "AIzaSyCP_99GGezJVDMXDdG4anXgrMNAzkGT_IY",
    authDomain: "tiandao-online-website-stats.firebaseapp.com",
    databaseURL: "https://tiandao-online-website-stats-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tiandao-online-website-stats",
    appId: "1:1041286935729:web:aad22dd3b3c846f124de90"
  }
};
