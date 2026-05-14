# 校园失物招领 - 管理员后台系统

## 项目简介

基于现有的校园失物招领小程序项目，开发了一套完整的管理员后台系统，提供物品管理、用户管理、线索管理、数据统计等功能。

## 技术栈

- **前端**: React 18 + Vite + Ant Design 5 + ECharts
- **后端**: Python Flask + SQLAlchemy + SQLite
- **端口**: 前端 3000，后端 3001

## 项目结构

```
├── backend-admin/          # 后端代码
│   ├── app.py             # Flask 主程序（含管理员API）
│   ├── requirements.txt   # Python 依赖
│   └── uploads/           # 图片上传目录（运行时生成）
│
└── admin-web/             # 前端代码
    ├── src/
    │   ├── components/    # 公共组件
    │   │   └── Layout.jsx # 后台布局
    │   ├── pages/        # 页面组件
    │   │   ├── Login.jsx      # 登录页
    │   │   ├── Dashboard.jsx  # 数据统计
    │   │   ├── ItemList.jsx   # 信息管理
    │   │   ├── UserList.jsx   # 用户管理
    │   │   ├── ClueList.jsx   # 线索管理
    │   │   └── StudentVerify.jsx # 学生认证
    │   ├── utils/        # 工具函数
    │   │   ├── request.js  # axios封装
    │   │   ├── api.js     # API接口
    │   │   └── auth.js    # 认证工具
    │   ├── App.jsx       # 主应用
    │   └── main.jsx      # 入口文件
    ├── package.json
    └── vite.config.js
```

## 快速启动

### 1. 启动后端

```bash
cd backend-admin
pip install -r requirements.txt
python app.py
```

后端将在 http://localhost:3001 启动

### 2. 启动前端

```bash
cd admin-web
npm install
npm run dev
```

前端将在 http://localhost:3000 启动

### 3. 登录

- 管理员账号: `000`
- 管理员密码: `0000`

## 功能模块

### 1. 数据统计 (Dashboard)

- 关键指标卡片：总发布数、待审核数、已认领数、用户总数
- 发布趋势图（折线图，按天统计近30天）
- 物品类型分布（饼图）
- 审核状态分布（饼图）

### 2. 信息管理 (ItemList)

- 失物/招领信息列表（分页+筛选）
- 筛选条件：
  - 类型（寻物/招领）
  - 状态（未认领/已认领）
  - 审核状态（待审核/已通过/已拒绝）
  - 时间范围
  - 关键词搜索
- 操作：
  - 查看详情（包含发布者联系方式）
  - 编辑内容
  - 删除信息
  - 审核通过/驳回
- 批量操作：
  - 批量审核
  - 批量删除

### 3. 用户管理 (UserList)

- 全体注册用户列表（分页+筛选）
- 筛选条件：
  - 用户名搜索
  - 学生认证状态
- 功能：
  - 查看用户详情
  - 查看用户发布记录
  - 封禁/解封用户账号

### 4. 线索管理 (ClueList)

- 待处理线索列表
- 查看线索详情（包含提交人联系方式）
- 采纳/拒绝线索

### 5. 学生认证 (StudentVerify)

- 学生认证申请列表
- 查看申请详情
- 批量审核认证申请

## API 接口

### 管理员认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/login` | POST | 管理员登录 |
| `/admin/logout` | POST | 管理员登出 |
| `/admin/check` | GET | 验证登录状态 |

### 用户管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/users` | GET | 用户列表（分页+筛选） |
| `/admin/users/:username/items` | GET | 用户发布记录 |
| `/admin/users/:username/ban` | POST | 封禁用户 |
| `/admin/users/:username/unban` | POST | 解封用户 |

### 物品管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/items` | GET | 所有物品（分页+筛选） |
| `/admin/items/:id` | PUT | 编辑物品 |
| `/admin/items/:id/review` | PUT | 审核物品 |
| `/admin/items/batch/review` | POST | 批量审核 |
| `/admin/items/batch/delete` | POST | 批量删除 |

### 线索管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/clues/all` | GET | 所有线索列表 |
| `/admin/clues/:id` | GET | 线索详情 |
| `/admin/clues/match` | POST | 采纳线索 |
| `/admin/clues/reject` | POST | 拒绝线索 |

### 数据统计

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/stats/overview` | GET | 总览统计 |
| `/admin/stats/trend` | GET | 发布趋势 |
| `/admin/stats/distribution` | GET | 分布统计 |

### 学生认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/student-verifications` | GET | 认证申请列表 |
| `/admin/student-verifications/batch` | POST | 批量审核认证 |

## 数据库表结构

### users (用户表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | VARCHAR(80) | 用户名 |
| password_hash | VARCHAR(256) | 密码哈希 |
| student_verified | BOOLEAN | 是否已认证 |
| student_verify_status | VARCHAR(16) | 认证状态 |
| real_name | VARCHAR(40) | 真实姓名 |
| student_no | VARCHAR(32) | 学号 |

### items (物品表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 描述 |
| image_url | VARCHAR(500) | 图片URL |
| status | VARCHAR(20) | 状态（未认领/已认领） |
| create_time | VARCHAR(32) | 创建时间 |
| publisher | VARCHAR(80) | 发布者 |
| claimer | VARCHAR(80) | 认领者 |
| post_type | VARCHAR(10) | 类型（寻物/招领） |
| location_id | VARCHAR(64) | 地点ID |
| location_label | VARCHAR(128) | 地点标签 |
| is_draft | BOOLEAN | 是否草稿 |
| review_status | VARCHAR(16) | 审核状态 |
| contact | VARCHAR(80) | 联系方式 |

### item_clues (线索表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| item_id | INTEGER | 关联物品ID |
| submitter | VARCHAR(80) | 提交人 |
| contact | VARCHAR(80) | 联系方式 |
| found_location | VARCHAR(200) | 发现地点 |
| found_time | VARCHAR(80) | 发现时间 |
| description | TEXT | 线索描述 |
| image_url | VARCHAR(500) | 图片URL |
| status | VARCHAR(16) | 状态 |
| create_time | VARCHAR(32) | 创建时间 |

## 注意事项

1. 管理员账号 `000` 是系统保留账号，普通用户无法注册
2. 前端通过 Vite 代理转发 API 请求到后端，避免跨域问题
3. Token 保存在 localStorage 中，前端重启不会导致登录失效
4. 数据库使用 SQLite，数据存储在 `backend-admin/campus_lost_found.db`

## 开发说明

- 前端开发时使用 `npm run dev` 启动开发服务器
- 后端修改后会自动生效（debug 模式）
- 如需重新安装依赖，先删除 node_modules，再执行 `npm install`
