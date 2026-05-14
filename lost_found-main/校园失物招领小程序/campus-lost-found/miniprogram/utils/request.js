// utils/request.js
// 封装 wx.request, 自动带 token, 自动做未登录拦截
// 【本次新增】同时导出 uploadFile, 封装 wx.uploadFile (表单上传)

const config = require("./config.js");

/**
 * 统一请求方法 (JSON 请求)
 * @param {string} url      - 接口路径, 如 /login
 * @param {string} method   - HTTP 方法, 默认 GET
 * @param {object} data     - 请求体 / 查询参数
 * @param {boolean} auth       - 是否需要带 token, 默认 true
 * @param {boolean} failToast  - 网络失败时是否弹出通用 toast, 默认 true（需要自定义提示时可设 false）
 */
function request({
  url,
  method = "GET",
  data = {},
  auth = true,
  failToast = true,
}) {
  return new Promise((resolve, reject) => {
    const header = { "Content-Type": "application/json" };

    if (auth) {
      const token = wx.getStorageSync("token");
      if (!token) {
        // 无 token, 直接踢回登录页
        wx.reLaunch({ url: "/pages/login/login" });
        reject(new Error("未登录"));
        return;
      }
      header["Authorization"] = token;
    }

    const fullUrl = config.baseUrl + url;
    wx.request({
      url: fullUrl,
      method,
      data,
      header,
      timeout: 20000,
      success: (res) => {
        // 后端返回 401 时统一踢回登录页
        if (res.statusCode === 401) {
          wx.removeStorageSync("token");
          wx.removeStorageSync("username");
          wx.reLaunch({ url: "/pages/login/login" });
          reject(new Error("登录已失效"));
          return;
        }
        resolve(res.data);
      },
      fail: (err) => {
        const hint = hintFromRequestFail(err);
        const errMsg = (err && err.errMsg) || "";
        console.error("[request fail]", fullUrl, errMsg, err);
        if (failToast) {
          wx.showToast({
            title: hint.length > 36 ? hint.slice(0, 36) + "…" : hint,
            icon: "none",
            duration: 3500,
          });
        }
        reject(err);
      },
    });
  });
}

/** 根据 wx.request fail 的 errMsg 给出简短排查提示（供地点库等关键接口使用） */
function hintFromRequestFail(err) {
  const m = (err && err.errMsg) || "";
  if (m.indexOf("domain") !== -1) {
    return "域名校验失败：开发工具里勾选「不校验合法域名…」或在后台配置 request 合法域名";
  }
  if (m.indexOf("timeout") !== -1) {
    return "请求超时：检查电脑/手机与后端是否同一网络、防火墙是否放行端口";
  }
  if (m.indexOf("127.0.0.1") !== -1 || m.indexOf("localhost") !== -1) {
    return "真机勿用127：改 config.js 的 LAN_IPV4 或 wx.setStorageSync dev_base_url";
  }
  if (m.indexOf("fail") !== -1 && (m.indexOf("connect") !== -1 || m.indexOf("CONNECTION") !== -1)) {
    return "连不上：开 Flask；ipconfig 改 LAN；防火墙放行5000；校园网 AP 隔离请设 PUBLIC_BASE_URL/ngrok";
  }
  return "无法连接后端：启动 Flask；校园网改 IP 或隧道；预览…打开调试";
}

/**
 * 文件上传 (multipart/form-data) 【本次新增】
 * 用于把本地图片路径上传给后端 /upload 接口
 * wx.uploadFile 与 wx.request 参数不一样, 单独封装更清晰
 *
 * @param {string} url        - 接口路径, 如 /upload
 * @param {string} filePath   - 本地临时文件路径 (wx.chooseMedia 返回的 tempFilePath)
 * @param {string} name       - form 字段名, 默认 "file" (需要与后端 request.files['file'] 对应)
 * @param {object} formData   - 额外的表单字段 (需要时再传, 当前没用到)
 * @param {boolean} auth      - 是否需要带 token, 默认 true
 * @returns {Promise<object>} 后端返回的 JSON 对象 (已自动 JSON.parse)
 */
function uploadFile({ url, filePath, name = "file", formData = {}, auth = true }) {
  return new Promise((resolve, reject) => {
    const header = {};

    if (auth) {
      const token = wx.getStorageSync("token");
      if (!token) {
        wx.reLaunch({ url: "/pages/login/login" });
        reject(new Error("未登录"));
        return;
      }
      header["Authorization"] = token;
    }

    const fullUrl = config.baseUrl + url;
    wx.uploadFile({
      url: fullUrl,
      filePath,
      name,
      header,
      formData,
      success: (res) => {
        if (res.statusCode === 401) {
          wx.removeStorageSync("token");
          wx.removeStorageSync("username");
          wx.reLaunch({ url: "/pages/login/login" });
          reject(new Error("登录已失效"));
          return;
        }
        // wx.uploadFile 的 res.data 是字符串, 需要自己 JSON.parse
        let parsed = {};
        try {
          parsed = JSON.parse(res.data);
        } catch (e) {
          wx.showToast({ title: "服务器返回格式错误", icon: "none" });
          reject(new Error("响应不是合法 JSON"));
          return;
        }
        resolve(parsed);
      },
      fail: (err) => {
        const hint = hintFromRequestFail(err);
        console.error("[uploadFile fail]", fullUrl, (err && err.errMsg) || "", err);
        wx.showToast({
          title: hint.length > 36 ? hint.slice(0, 36) + "…" : hint,
          icon: "none",
          duration: 3500,
        });
        reject(err);
      },
    });
  });
}

module.exports = { request, uploadFile, hintFromRequestFail };
