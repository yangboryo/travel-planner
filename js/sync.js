/* GitHub Secret Gist 云同步:用户数据先在本机加密,token/密钥不上传。 */

var SYNC_STORE_KEY = "travel-planner-sync";
var SYNC_FILE_NAME = "travel-planner-data.json";
var SYNC_API = "https://api.github.com";
var SYNC_FORMAT = "travel-planner-encrypted";
var SYNC_KDF_ITERATIONS = 250000;
var SYNC_TIMER = null;
var SYNC_BUSY = false;
var PENDING_SYNC_PASSWORD = "";

function reconcile(localUpdatedAt, remoteUpdatedAt, baseline, dirty) {
  if (!baseline) return remoteUpdatedAt ? "PULL" : "PUSH";
  var remoteChanged = !!remoteUpdatedAt && remoteUpdatedAt > baseline;
  if (remoteChanged && dirty) return "CONFLICT";
  if (remoteChanged) return "PULL";
  if (dirty) return "PUSH";
  return "NOOP";
}

function loadSyncState() {
  var defaults = { token: "", gistId: "", baseline: "", dirty: false,
    lastSyncAt: "", status: "local", message: "尚未设置云同步",
    encryptionKey: "", encryptionSalt: "" };
  if (typeof localStorage === "undefined") return defaults;
  try {
    var saved = JSON.parse(localStorage.getItem(SYNC_STORE_KEY) || "{}");
    Object.keys(saved).forEach(function (key) { defaults[key] = saved[key]; });
  } catch (e) { /* 损坏时使用默认值 */ }
  return defaults;
}

var SYNC_STATE = loadSyncState();

function saveSyncState() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SYNC_STORE_KEY, JSON.stringify(SYNC_STATE));
  refreshSyncUI();
}

function refreshSyncUI() {
  if (typeof document !== "undefined" && typeof renderSyncSection === "function" &&
      document.getElementById("sync-status")) renderSyncSection();
}

function setSyncStatus(status, message) {
  SYNC_STATE.status = status;
  SYNC_STATE.message = message;
  saveSyncState();
}

function cloudPayload() {
  return { trips: STATE.trips, passport: STATE.passport, updatedAt: STATE.updatedAt };
}

function bytesToBase64(bytes) {
  var binary = "";
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value) {
  var binary = atob(value);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function deriveEncryptionKey(password, saltBytes) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false,
    ["deriveKey"]).then(function (material) {
    return crypto.subtle.deriveKey({
      name: "PBKDF2", salt: saltBytes, iterations: SYNC_KDF_ITERATIONS, hash: "SHA-256"
    }, material, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  });
}

function importSavedEncryptionKey() {
  if (!SYNC_STATE.encryptionKey) return Promise.resolve(null);
  return crypto.subtle.importKey("raw", base64ToBytes(SYNC_STATE.encryptionKey),
    { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function rememberEncryptionKey(key, saltBytes) {
  return crypto.subtle.exportKey("raw", key).then(function (raw) {
    SYNC_STATE.encryptionKey = bytesToBase64(new Uint8Array(raw));
    SYNC_STATE.encryptionSalt = bytesToBase64(saltBytes);
    saveSyncState();
    return key;
  });
}

function getEncryptionKey(saltBase64) {
  var saltBytes = base64ToBytes(saltBase64);
  if (SYNC_STATE.encryptionKey && SYNC_STATE.encryptionSalt === saltBase64) {
    return importSavedEncryptionKey();
  }
  if (!PENDING_SYNC_PASSWORD) {
    throw new Error("此设备缺少同步密钥,请清除设置后重新输入 token 和同步密码");
  }
  return deriveEncryptionKey(PENDING_SYNC_PASSWORD, saltBytes).then(function (key) {
    return rememberEncryptionKey(key, saltBytes);
  });
}

function createEncryptionKey() {
  if (!PENDING_SYNC_PASSWORD) throw new Error("请设置同步密码");
  var salt = crypto.getRandomValues(new Uint8Array(16));
  return deriveEncryptionKey(PENDING_SYNC_PASSWORD, salt).then(function (key) {
    return rememberEncryptionKey(key, salt);
  });
}

function encryptPayload(payload) {
  var keyPromise = SYNC_STATE.encryptionKey ? importSavedEncryptionKey() : createEncryptionKey();
  return keyPromise.then(function (key) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var plaintext = new TextEncoder().encode(JSON.stringify(payload));
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext).then(function (ciphertext) {
      return {
        format: SYNC_FORMAT,
        version: 1,
        updatedAt: payload.updatedAt,
        kdf: { name: "PBKDF2", hash: "SHA-256", iterations: SYNC_KDF_ITERATIONS,
          salt: SYNC_STATE.encryptionSalt },
        cipher: { name: "AES-GCM", iv: bytesToBase64(iv),
          data: bytesToBase64(new Uint8Array(ciphertext)) }
      };
    });
  });
}

function decryptEnvelope(envelope) {
  if (!envelope || envelope.format !== SYNC_FORMAT || !envelope.kdf || !envelope.cipher) {
    throw new Error("云端数据未加密,已停止同步以保护隐私");
  }
  if (envelope.kdf.iterations !== SYNC_KDF_ITERATIONS) {
    throw new Error("云端加密参数不受支持");
  }
  return getEncryptionKey(envelope.kdf.salt).then(function (key) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(envelope.cipher.iv) },
      key, base64ToBytes(envelope.cipher.data));
  }).then(function (plaintext) {
    var data = JSON.parse(new TextDecoder().decode(plaintext));
    if (!data || !Array.isArray(data.trips) || !data.passport || !data.updatedAt) {
      throw new Error("解密后的云端数据不完整");
    }
    return data;
  }).catch(function (error) {
    if (/未加密|不受支持|缺少同步密钥|不完整/.test(error.message)) throw error;
    SYNC_STATE.encryptionKey = "";
    SYNC_STATE.encryptionSalt = "";
    saveSyncState();
    throw new Error("同步密码不正确,云端数据未被修改");
  });
}

function gistRequest(path, options) {
  options = options || {};
  var headers = options.headers || {};
  headers.Accept = "application/vnd.github+json";
  headers.Authorization = "Bearer " + SYNC_STATE.token;
  headers["X-GitHub-Api-Version"] = "2022-11-28";
  if (options.body) headers["Content-Type"] = "application/json";
  options.headers = headers;
  return fetch(SYNC_API + path, options).then(function (response) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("GitHub token 无效或没有 gist 权限");
    }
    if (!response.ok) throw new Error("GitHub 同步失败(" + response.status + ")");
    return response.status === 204 ? null : response.json();
  });
}

function createGist() {
  return encryptPayload(cloudPayload()).then(function (encrypted) {
    var files = {};
    files[SYNC_FILE_NAME] = { content: JSON.stringify(encrypted, null, 2) };
    return gistRequest("/gists", {
      method: "POST",
      body: JSON.stringify({ description: "私人出行助理加密同步数据", public: false, files: files })
    });
  }).then(function (gist) {
    SYNC_STATE.gistId = gist.id;
    SYNC_STATE.baseline = STATE.updatedAt;
    SYNC_STATE.dirty = false;
    SYNC_STATE.lastSyncAt = new Date().toISOString();
    saveSyncState();
    return gist.id;
  });
}

function findOrCreateGist() {
  if (SYNC_STATE.gistId) return Promise.resolve(SYNC_STATE.gistId);
  return gistRequest("/gists?per_page=100").then(function (gists) {
    var found = gists.find(function (gist) { return !!gist.files[SYNC_FILE_NAME]; });
    if (!found) return createGist();
    SYNC_STATE.gistId = found.id;
    saveSyncState();
    return found.id;
  });
}

function parseEncryptedRemote(text) {
  var envelope;
  try { envelope = JSON.parse(text); } catch (e) { throw new Error("云端数据格式不正确"); }
  return decryptEnvelope(envelope);
}

function readRemote(gistId) {
  return gistRequest("/gists/" + gistId).then(function (gist) {
    var file = gist.files[SYNC_FILE_NAME];
    if (!file) throw new Error("云端同步文件不存在");
    if (file.truncated && file.raw_url) {
      return fetch(file.raw_url).then(function (r) {
        if (!r.ok) throw new Error("云端数据读取失败");
        return r.text();
      }).then(parseEncryptedRemote);
    }
    return parseEncryptedRemote(file.content);
  });
}

function pushRemote(gistId) {
  return encryptPayload(cloudPayload()).then(function (encrypted) {
    var files = {};
    files[SYNC_FILE_NAME] = { content: JSON.stringify(encrypted, null, 2) };
    return gistRequest("/gists/" + gistId, {
      method: "PATCH", body: JSON.stringify({ files: files })
    });
  }).then(function () {
    SYNC_STATE.baseline = STATE.updatedAt;
    SYNC_STATE.dirty = false;
    SYNC_STATE.lastSyncAt = new Date().toISOString();
    setSyncStatus("synced", "已加密同步");
  });
}

function pullRemote(remote) {
  STATE.trips = remote.trips;
  STATE.passport = remote.passport;
  STATE.updatedAt = remote.updatedAt;
  localStorage.setItem(STORE_KEY, JSON.stringify(STATE));
  SYNC_STATE.baseline = remote.updatedAt;
  SYNC_STATE.dirty = false;
  SYNC_STATE.lastSyncAt = new Date().toISOString();
  setSyncStatus("synced", "已解密并从云端更新");
  if (typeof renderTripList === "function") renderTripList();
  if (document.querySelector("#screen-calendar.active") && typeof renderCalendar === "function") renderCalendar();
  if (document.querySelector("#screen-profile.active") && typeof renderProfile === "function") renderProfile();
}

function resolveConflict(gistId, remote) {
  localStorage.setItem("travel-planner-conflict-backup", JSON.stringify({
    local: cloudPayload(), remote: remote, savedAt: new Date().toISOString()
  }));
  setSyncStatus("conflict", "本机和云端都有修改,等待选择");
  var choice = prompt(
    "发现同步冲突\n\n本机修改: " + formatSyncTime(STATE.updatedAt) +
    "\n云端修改: " + formatSyncTime(remote.updatedAt) +
    "\n\n已在本机自动保存冲突快照。\n输入 1 = 保留本机并覆盖云端" +
    "\n输入 2 = 使用云端并覆盖本机\n关闭窗口 = 暂不处理", "");
  if (choice === "1") return pushRemote(gistId);
  if (choice === "2") return Promise.resolve(pullRemote(remote));
  return Promise.resolve();
}

function syncNow() {
  if (!SYNC_STATE.token || !SYNC_STATE.encryptionKey && !PENDING_SYNC_PASSWORD) {
    setSyncStatus("local", "请设置 GitHub token 和同步密码");
    return Promise.resolve();
  }
  if (typeof crypto === "undefined" || !crypto.subtle) {
    setSyncStatus("error", "当前浏览器不支持安全加密");
    return Promise.resolve();
  }
  if (SYNC_BUSY) return Promise.resolve();
  SYNC_BUSY = true;
  setSyncStatus("syncing", "正在加密同步…");
  return findOrCreateGist().then(function (gistId) {
    return readRemote(gistId).then(function (remote) {
      var action = reconcile(STATE.updatedAt, remote.updatedAt,
        SYNC_STATE.baseline, SYNC_STATE.dirty);
      if (action === "PUSH") return pushRemote(gistId);
      if (action === "PULL") return pullRemote(remote);
      if (action === "CONFLICT") return resolveConflict(gistId, remote);
      SYNC_STATE.lastSyncAt = new Date().toISOString();
      setSyncStatus("synced", "已加密同步");
    });
  }).catch(function (error) {
    var offline = typeof navigator !== "undefined" && navigator.onLine === false;
    setSyncStatus(offline ? "offline" : "error", offline ? "离线,稍后自动重试" : error.message);
  }).then(function () {
    PENDING_SYNC_PASSWORD = "";
    SYNC_BUSY = false;
  });
}

function scheduleSync() {
  if (!SYNC_STATE.token || !SYNC_STATE.encryptionKey) return;
  clearTimeout(SYNC_TIMER);
  SYNC_TIMER = setTimeout(syncNow, 4000);
}

function markSyncDirty() {
  SYNC_STATE.dirty = true;
  SYNC_STATE.status = SYNC_STATE.token ? "dirty" : "local";
  SYNC_STATE.message = SYNC_STATE.token ? "有未同步修改" : "仅保存在本机";
  saveSyncState();
  scheduleSync();
}

function saveSyncCredentials() {
  var tokenInput = document.getElementById("sync-token");
  var passwordInput = document.getElementById("sync-password");
  var confirmInput = document.getElementById("sync-password-confirm");
  var token = tokenInput ? tokenInput.value.trim() : "";
  var password = passwordInput ? passwordInput.value : "";
  var confirmation = confirmInput ? confirmInput.value : "";
  if (!token) { alert("请粘贴 GitHub classic token"); return; }
  if (password.length < 10) { alert("同步密码至少需要 10 个字符"); return; }
  if (password !== confirmation) { alert("两次输入的同步密码不一致"); return; }
  SYNC_STATE.token = token;
  SYNC_STATE.gistId = "";
  SYNC_STATE.baseline = "";
  SYNC_STATE.encryptionKey = "";
  SYNC_STATE.encryptionSalt = "";
  SYNC_STATE.status = "dirty";
  SYNC_STATE.message = "正在建立加密连接…";
  PENDING_SYNC_PASSWORD = password;
  saveSyncState();
  syncNow();
}

function clearSyncToken() {
  if (!confirm("清除本机 token 和同步密钥? 本地行程不会删除。")) return;
  PENDING_SYNC_PASSWORD = "";
  SYNC_STATE = { token: "", gistId: "", baseline: "", dirty: false,
    lastSyncAt: "", status: "local", message: "尚未设置云同步",
    encryptionKey: "", encryptionSalt: "" };
  saveSyncState();
}

function formatSyncTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("zh-CN", { hour12: false }); }
  catch (e) { return iso; }
}

if (typeof module !== "undefined" && module.exports) module.exports = {
  reconcile: reconcile,
  deriveEncryptionKey: deriveEncryptionKey,
  bytesToBase64: bytesToBase64,
  base64ToBytes: base64ToBytes
};
