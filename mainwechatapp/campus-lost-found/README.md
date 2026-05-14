# 校园失物招领 - 微信小程序 + Flask 后端

## 一、项目诊断说明

经检查，原项目文件**内容与文件名均对应正确**，无错位问题。
主要整理内容：
- 后端目录从 `server/` 统一重命名为 `backend/`（符合提交规范）
- `app.py` 中 `claim_item` 接口增加了 `item_id` 类型容错（前端传来的 id 可能是 int 或 string）
- `list_items` 接口返回字段精简，只暴露前端需要的字段
- 补充本 README 说明文档

---

## 二、最终目录结构

```
campus-lost-found/
├── project.config.json          # 微信开发者工具项目配置
├── miniprogram/
│   ├── app.js                   # 全局入口
│   ├── app.json                 # 页面注册 + 窗口样式
│   ├── app.wxss                 # 全局公共样式
│   ├── sitemap.json             # 页面索引配置
│   ├── utils/
│   │   ├── config.js            # BASE_URL 统一配置
│   │   └── request.js           # 封装请求 / token / 401 拦截
│   └── pages/
│       ├── login/               # 登录页
│       ├── register/            # 注册页
│       ├── index/               # 首页（失物列表）
│       └── publish/             # 发布页
└── backend/
    ├── app.py                   # Flask 后端
    └── requirements.txt         # 依赖
```

---

## 三、联调说明

### 3.1 启动后端

```bash
cd backend
pip install -r requirements.txt
python app.py
```

启动后终端显示：
```
* Running on http://0.0.0.0:5000
```

验证后端是否正常：浏览器访问 `http://127.0.0.1:5000/`，返回 `{"code":0,"message":"Campus Lost & Found API is running"}` 即正常。

### 3.2 配置 BASE_URL

打开 `miniprogram/utils/config.js`：

```js
const config = {
  baseUrl: "http://127.0.0.1:5000",  // 改这里
};
```

| 场景 | baseUrl 填写 |
|------|------------|
| 开发者工具模拟器 | `http://127.0.0.1:5000` |
| 真机预览（手机扫码） | `http://192.168.x.x:5000`（改成你电脑的局域网 IP） |

> 查看局域网 IP：Windows 运行 `ipconfig`，Mac/Linux 运行 `ifconfig`，找 192.168.x.x 段。

### 3.3 开发者工具设置

1. 打开微信开发者工具 → 导入项目
2. 目录选择本项目根目录（含 `project.config.json` 的那一层）
3. AppID 填 `touristappid`（游客模式，无需真实 AppID 即可运行）
4. 工具栏 → **详情** → 本地设置 → 勾选「**不校验合法域名**」（本地调试必须勾选）

### 3.4 真机调试

1. 将 `config.js` 的 `baseUrl` 改为电脑局域网 IP
2. 手机和电脑连同一个 WiFi
3. 开发者工具 → 预览 → 手机扫码

---

## 四、测试步骤

### 4.1 注册测试

1. 打开小程序，自动进入登录页
2. 点击「去注册」
3. 输入账号（≥2位）、密码（≥4位），点击「注册」
4. 出现「注册成功」toast，自动返回登录页 ✅

### 4.2 登录测试

1. 输入刚注册的账号和密码，点击「登录」
2. 出现「登录成功」toast，跳转首页 ✅
3. 首页显示「Hi, 你的用户名」

### 4.3 未登录拦截测试

1. 清除 Storage（开发者工具 → AppData → Storage → 全部清空）
2. 直接访问首页路径（在地址栏手动输入或重启）
3. 应自动跳回登录页 ✅

### 4.4 首页列表测试

1. 登录后进入首页
2. 此时列表为空，显示「暂无失物信息」
3. 下拉刷新，页面转圈后停止 ✅

### 4.5 发布测试

1. 首页点击「+ 去发布」
2. 输入标题和描述，点击「提交发布」
3. 出现「发布成功」toast，返回首页
4. 首页列表出现刚发布的物品，状态为「未认领」 ✅

### 4.6 认领测试

1. 首页找到一条「未认领」物品
2. 点击「认领」按钮
3. 弹出确认框，点击「确定」
4. 出现「认领成功」toast
5. 该物品状态变为「已认领」，按钮变灰不可点 ✅

---

## 五、接口文档（快速参考）

| 方法 | 路径 | 是否需要 token | 说明 |
|------|------|--------------|------|
| POST | /register | 否 | 注册 |
| POST | /login | 否 | 登录，返回 token |
| GET | /items | 是 | 获取失物列表 |
| POST | /items | 是 | 发布失物 |
| POST | /items/claim | 是 | 认领物品 |

Token 传递方式：请求头 `Authorization: <token字符串>`
