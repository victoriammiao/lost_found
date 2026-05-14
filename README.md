# 后台管理系统

## admin-web\start.bat

- 切到 admin-web 目录
- 若没有 node_modules，会先执行 npm install
- 再执行 npm run dev（Vite 开发服）

## backend-admin\start.bat

- 切到 backend-admin 目录
- 若存在 `..\.venv`（仓库根目录虚拟环境）或 `backend-admin\.venv`，会先 activate
- 再执行 python app.py（与 app.py 里一致：`http://0.0.0.0:3001`）

首次使用 backend-admin 若根目录还没有 `.venv`，需先在仓库根或 backend-admin 里建好环境并安装依赖，例如：

`python -m venv .venv` → `.\.venv\Scripts\activate` → `pip install -r backend-admin\requirements.txt`

之后直接双击 `backend-admin\start.bat` 即可。

# 微信小程序

## 打开方法

1. 安装并打开 **微信开发者工具**（Windows 选稳定版即可）。
2. **导入项目**（或「打开目录」），**项目目录** 选到本仓库下的 **`mainwechatapp`** 文件夹（与 `mainwechatapp\project.config.json` 同级），例如：
   - `...\lost-and-found\mainwechatapp`
3. **不要**选仓库根目录 `lost-and-found`，**不要**单独选 `mainwechatapp\campus-lost-found\miniprogram`。根目录配置里已通过 `miniprogramRoot` 指向 `campus-lost-found/miniprogram/`，工具会自动加载其中的 `app.json`。
4. 填写或确认 **AppID**（测试可选用工具提供的测试号；上传体验版需使用公众平台注册的小程序 AppID）。

## 本地接口调试

- 开发者工具：**详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**，否则请求 `http://127.0.0.1` 等本地地址会报域名错误。本仓库 `mainwechatapp\project.private.config.json` 中已将 `urlCheck` 设为 `false`，若仍提示校验，请再核对上述勾选。
- 小程序请求的后端默认见 `mainwechatapp\campus-lost-found\miniprogram\utils\config.js`（如 `http://127.0.0.1:5000`）。需在 **`mainwechatapp\campus-lost-found\backend`** 启动 Flask（`python app.py`，端口 **5000**），否则会 `CONNECTION_REFUSED`。
- **真机预览**时，手机上的 `127.0.0.1` 指向手机自身，无法访问你电脑上的服务。请在同一 WiFi 下把 `config.js` 里的 **`LAN_IPV4`** 改为你电脑的局域网 IPv4，或使用 ngrok 等隧道并在代码/本地存储中配置 `dev_base_url`（详见该文件内注释）。
