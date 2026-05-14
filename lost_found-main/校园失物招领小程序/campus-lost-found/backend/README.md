# 后端启动说明

技术栈：Flask + SQLite，默认监听 **5000** 端口，`debug=True`。

## 环境要求

- 已安装 **Python 3**（建议 3.10+；当前仓库在 Windows 上可用 `python` / `python.exe` 调用）。

## 安装依赖

在 **本目录**（含 `requirements.txt`、`app.py`）下打开终端，执行：

```powershell
cd C:\Users\apple\Desktop\lost-and-found\校园失物招领小程序\campus-lost-found\backend
```

推荐使用模块方式安装，避免升级 pip 后 `Scripts` 未加入 PATH 导致找不到 `pip` 命令：

```powershell
python -m pip install -r requirements.txt
```

若已升级过 pip 且出现 “scripts … is not on PATH” 的提示，不影响上述命令；需要单独使用 `pip` 时，可把  
`%APPDATA%\Python\Python3xx\Scripts` 加入用户环境变量 **PATH**，或继续统一使用 `python -m pip …`。

## 启动服务

仍在 `backend` 目录下：

```powershell
python app.py
```

成功时终端会类似：

```text
* Running on http://0.0.0.0:5000
```

## 验证

浏览器访问：

- `http://127.0.0.1:5000/`  
  应返回 JSON：`{"code":0,"message":"Campus Lost & Found API is running"}`（以实际响应为准）。

## 与小程序联调

- 开发者工具模拟器：小程序里 `baseUrl` 使用 `http://127.0.0.1:5000`。
- 真机预览：手机无法访问你电脑的 `127.0.0.1`，需把 `baseUrl` 改为电脑的 **局域网 IP**（如 `http://192.168.x.x:5000`），且手机与电脑同一 WiFi；开发者工具中按需勾选「不校验合法域名」用于本地 HTTP 调试。

## 数据与上传目录

- 数据库文件：`backend/campus_lost_found.db`（首次启动会自动创建表并做迁移逻辑）。
- 图片目录：`backend/uploads/`（自动创建）。
