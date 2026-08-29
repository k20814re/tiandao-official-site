import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  get,
  getDatabase,
  onDisconnect,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const section = document.querySelector('.site-stats');
const visitorOutput = document.querySelector('#visitorCount');
const onlineOutput = document.querySelector('#onlineCount');
const status = document.querySelector('#statsStatus');
const config = window.TIANDAO_STATS_CONFIG;

const setState = (message, state = 'ready') => {
  if (status) status.textContent = message;
  section?.classList.toggle('stats-ready', state === 'ready');
  section?.classList.toggle('stats-error', state === 'error');
};

const formatCount = value => new Intl.NumberFormat('zh-Hant-TW').format(value);

if (!config?.enabled) {
  setState('統計資料庫尚未啟用', 'error');
} else {
  try {
    const app = initializeApp(config.firebase);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    const { user } = await signInAnonymously(auth);
    const database = getDatabase(app);

    const visitorRef = ref(database, `siteStats/visitors/${user.uid}`);
    const visitorSnapshot = await get(visitorRef);
    if (visitorSnapshot.exists()) {
      await update(visitorRef, { lastSeen: serverTimestamp() });
    } else {
      await set(visitorRef, { firstSeen: serverTimestamp(), lastSeen: serverTimestamp() });
    }

    const visitorsRef = ref(database, 'siteStats/visitors');
    onValue(visitorsRef, snapshot => {
      if (visitorOutput) visitorOutput.value = formatCount(snapshot.size);
    });

    const presenceRootRef = ref(database, 'siteStats/presence');
    onValue(presenceRootRef, snapshot => {
      let onlineUsers = 0;
      snapshot.forEach(userSnapshot => {
        if (userSnapshot.hasChildren()) onlineUsers += 1;
      });
      if (onlineOutput) onlineOutput.value = formatCount(onlineUsers);
    });

    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, async snapshot => {
      if (snapshot.val() !== true) {
        setState('天機連線暫時中斷，正在重新感應……', 'error');
        return;
      }

      const connectionRef = push(ref(database, `siteStats/presence/${user.uid}`));
      await onDisconnect(connectionRef).remove();
      await set(connectionRef, { connectedAt: serverTimestamp() });
      setState('天機連線正常 · 人數即時更新');
    });
  } catch (error) {
    console.error('TianDao site statistics failed to start.', error);
    setState('人數統計暫時無法連線', 'error');
  }
}
