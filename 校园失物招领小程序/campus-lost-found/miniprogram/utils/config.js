// utils/config.js
// 统一配置后端地址（真机不能用 127.0.0.1 指向电脑上的 Flask）

const BACKEND_PORT = 5000;

// —— 局域网直连（校园网 / 同一路由 WiFi）——
// 电脑 cmd 执行 ipconfig，看当前已联网适配器的「IPv4」（换热点/换校园网后要重填）。
// 若仍「连不上服务器」，很多校园 WiFi 开了 AP 隔离（手机 ping 不到电脑），请改用下面 PUBLIC_BASE_URL。
const LAN_IPV4 = "10.253.28.228";

// —— 隧道 / 公网调试地址（可选）——
// 校园网隔离时：电脑安装 ngrok 等，执行 `ngrok http 5000`，把给出的 https 根地址填这里（无末尾 /）。
// 也可不设此项，只在真机调试控制台执行：
// wx.setStorageSync("dev_base_url", "https://xxxx.ngrok-free.app")
const PUBLIC_BASE_URL = "";

function _normalizeBaseUrl(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  return u.replace(/\/+$/, "");
}

function _stripHost(raw) {
  let h = String(raw || "").trim();
  if (!h) return "";
  h = h.replace(/^https?:\/\//i, "");
  const slash = h.indexOf("/");
  if (slash !== -1) h = h.slice(0, slash);
  const colon = h.indexOf(":");
  if (colon !== -1) h = h.slice(0, colon);
  return h;
}

function _useLoopback() {
  try {
    const p = wx.getSystemInfoSync().platform || "";
    return p === "devtools" || p === "windows" || p === "mac";
  } catch (e) {
    return false;
  }
}

function resolveBaseUrl() {
  const custom = _normalizeBaseUrl(wx.getStorageSync("dev_base_url"));
  if (custom) {
    return custom;
  }

  const pub = _normalizeBaseUrl(PUBLIC_BASE_URL);

  // 真机一律优先隧道（校园 AP 隔离），否则走局域网 IPv4
  try {
    const p = String(wx.getSystemInfoSync().platform || "").toLowerCase();
    if (p === "ios" || p === "android") {
      if (pub) {
        return pub;
      }
      const host = _stripHost(LAN_IPV4);
      if (!host) {
        return `http://127.0.0.1:${BACKEND_PORT}`;
      }
      return `http://${host}:${BACKEND_PORT}`;
    }
  } catch (e) {
    // ignore
  }

  if (_useLoopback()) {
    return `http://127.0.0.1:${BACKEND_PORT}`;
  }

  if (pub) {
    return pub;
  }

  const host = _stripHost(LAN_IPV4);
  if (!host) {
    return `http://127.0.0.1:${BACKEND_PORT}`;
  }
  return `http://${host}:${BACKEND_PORT}`;
}

module.exports = {
  get baseUrl() {
    return resolveBaseUrl();
  },
};
