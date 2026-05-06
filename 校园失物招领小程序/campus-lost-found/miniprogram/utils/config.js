// utils/config.js
// 统一配置后端地址, 需要改 IP/端口时只改这里

const config = {
  // 开发者工具 + 本机 Flask: 直接写 127.0.0.1
  // 真机预览时必须改成电脑的局域网 IP, 例如 http://192.168.1.5:5000
  baseUrl: "http://127.0.0.1:5000",
};

module.exports = config;
