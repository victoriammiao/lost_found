# -*- coding: utf-8 -*-
"""
校园失物招领 - 后端主程序 (MVP 版)
技术栈: Flask + flask-cors
数据: 内存存储 (进程重启会清空, 适合课堂演示)
接口清单:
  POST /register            - 注册
  POST /login               - 登录
  GET  /items               - 获取失物列表 (需登录)
  POST /items               - 发布失物 (需登录, 可选带 imageUrl)
  POST /items/claim         - 认领物品 (需登录)
  POST /upload              - 上传图片 (需登录)          【本次新增】
  GET  /uploads/<filename>  - 图片静态访问 (无需登录)    【本次新增】
  GET  /                    - 健康检查
"""

import os
import uuid
import time
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # 开放跨域, 方便小程序本地联调

# ============================== 文件上传配置 【本次新增】 ==============================
# 图片存储目录, 相对于 app.py 所在目录 -> backend/uploads/
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
# 允许的图片后缀 (题目要求: jpg, jpeg, png)
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
# 单张图片最大 5MB, 超限 Flask 会自动返回 413
MAX_CONTENT_LENGTH = 5 * 1024 * 1024

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# 启动时自动创建 uploads 目录, 免去手动 mkdir
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """判断文件后缀是否允许"""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


# ============================== 内存数据 ==============================
# 用户表: [{ "id": int, "username": str, "password": str }]
users = []

# 失物表: [{ "id": int, "title": str, "description": str, "imageUrl": str,
#             "status": "未认领"|"已认领", "createTime": str,
#             "publisher": str, "claimer": str|None }]
# 【本次新增字段】imageUrl: 形如 "/uploads/xxxx.jpg" 的相对路径, 没图片就是空串 ""
items = []

# token -> username  (登录态, 仅作演示, 不做过期)
tokens = {}

_user_id_seq = 0
_item_id_seq = 0


def next_user_id():
    global _user_id_seq
    _user_id_seq += 1
    return _user_id_seq


def next_item_id():
    global _item_id_seq
    _item_id_seq += 1
    return _item_id_seq


def now_str():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())


def find_user_by_username(username):
    for u in users:
        if u["username"] == username:
            return u
    return None


def find_item_by_id(item_id):
    for it in items:
        if it["id"] == item_id:
            return it
    return None


# ============================== 登录校验装饰器 ==============================
def login_required(func):
    """
    受保护接口需要在请求头带: Authorization: <token>
    后端通过 tokens 字典校验, 未通过返回 401
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").strip()
        if not token or token not in tokens:
            return jsonify({"code": 401, "message": "未登录或登录已失效"}), 401
        # 把当前用户名挂到 request, 方便接口内使用
        request.current_user = tokens[token]
        return func(*args, **kwargs)
    return wrapper


# ============================== 接口实现 ==============================

@app.route("/register", methods=["POST"])
def register():
    """注册接口, 无需 token"""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"code": 1, "message": "账号和密码不能为空"})
    if len(username) < 2:
        return jsonify({"code": 1, "message": "账号不能少于2位"})
    if len(password) < 4:
        return jsonify({"code": 1, "message": "密码不能少于4位"})
    if find_user_by_username(username):
        return jsonify({"code": 1, "message": "该账号已被注册"})

    user = {
        "id": next_user_id(),
        "username": username,
        "password": password,
    }
    users.append(user)
    return jsonify({"code": 0, "message": "注册成功"})


@app.route("/login", methods=["POST"])
def login():
    """登录接口, 无需 token"""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"code": 1, "message": "账号和密码不能为空"})

    user = find_user_by_username(username)
    if not user or user["password"] != password:
        return jsonify({"code": 1, "message": "账号或密码错误"})

    # 生成 mock token
    token = "mock-" + uuid.uuid4().hex
    tokens[token] = username

    return jsonify({
        "code": 0,
        "message": "登录成功",
        "token": token,
        "username": username,
    })


@app.route("/items", methods=["GET"])
@login_required
def list_items():
    """获取失物列表, 按 id 倒序 (最新发布在前). 本次新增返回 imageUrl 字段"""
    data = sorted(items, key=lambda x: x["id"], reverse=True)
    result = [
        {
            "id": it["id"],
            "title": it["title"],
            "description": it["description"],
            "status": it["status"],
            "createTime": it["createTime"],
            "imageUrl": it.get("imageUrl", ""),  # 【本次新增】没图片就是空串
        }
        for it in data
    ]
    return jsonify({"code": 0, "message": "ok", "data": result})


@app.route("/items", methods=["POST"])
@login_required
def publish_item():
    """
    发布失物, 需要登录.
    请求体仍然是 JSON, 本次新增可选字段 imageUrl (先走 /upload 拿到再传过来).
    没有图片时前端传空串或不传都可以, 不影响原有发布流程.
    """
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    image_url = (data.get("imageUrl") or "").strip()  # 【本次新增】可选

    if not title:
        return jsonify({"code": 1, "message": "标题不能为空"})
    if not description:
        return jsonify({"code": 1, "message": "描述不能为空"})

    item = {
        "id": next_item_id(),
        "title": title,
        "description": description,
        "imageUrl": image_url,  # 【本次新增】没图片就是空串
        "status": "未认领",
        "createTime": now_str(),
        "publisher": request.current_user,
        "claimer": None,
    }
    items.append(item)
    return jsonify({"code": 0, "message": "发布成功", "data": {
        "id": item["id"],
        "title": item["title"],
        "description": item["description"],
        "imageUrl": item["imageUrl"],
        "status": item["status"],
        "createTime": item["createTime"],
    }})


@app.route("/items/claim", methods=["POST"])
@login_required
def claim_item():
    """认领物品, 需要登录"""
    data = request.get_json(silent=True) or {}
    item_id = data.get("id")

    if item_id is None:
        return jsonify({"code": 1, "message": "缺少物品 id"})

    # item_id 可能从前端传来是 int 或 str, 统一转 int
    try:
        item_id = int(item_id)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "message": "物品 id 格式错误"})

    item = find_item_by_id(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item["status"] == "已认领":
        return jsonify({"code": 1, "message": "该物品已被认领"})

    item["status"] = "已认领"
    item["claimer"] = request.current_user
    return jsonify({"code": 0, "message": "认领成功"})


# ============================== 图片上传 + 静态访问 【本次新增】 ==============================

@app.route("/upload", methods=["POST"])
@login_required
def upload_image():
    """
    上传单张图片 (multipart/form-data)
    - 字段名固定为 'file' (与小程序 wx.uploadFile 的 name 字段对应)
    - 仅允许 jpg / jpeg / png
    - 保存到 backend/uploads/, 文件名用 uuid 避免冲突
    - 成功返回: {code:0, message:"上传成功", data: {"imageUrl": "/uploads/xxxx.jpg"}}
    """
    if "file" not in request.files:
        return jsonify({"code": 1, "message": "未收到图片文件 (字段名应为 file)"})

    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"code": 1, "message": "图片文件为空"})

    # secure_filename 可能会把全中文文件名清空, 这里兜底成 upload.jpg
    original_name = secure_filename(f.filename) or "upload.jpg"
    if not allowed_file(original_name):
        return jsonify({"code": 1, "message": "仅支持 jpg / jpeg / png 格式"})

    ext = original_name.rsplit(".", 1)[1].lower()
    new_name = "{}.{}".format(uuid.uuid4().hex, ext)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], new_name)

    try:
        f.save(save_path)
    except Exception as e:
        return jsonify({"code": 1, "message": "保存图片失败: {}".format(e)})

    # 返回相对路径, 前端自己拼 baseUrl 即可访问
    image_url = "/uploads/{}".format(new_name)
    return jsonify({
        "code": 0,
        "message": "上传成功",
        "data": {"imageUrl": image_url},
    })


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    """
    图片静态访问接口
    小程序 <image src="http://127.0.0.1:5000/uploads/xxx.jpg"> 就能直接渲染
    注意: 这里不加 login_required, 否则图片拉不出来
    """
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# ============================== 健康检查 ==============================
@app.route("/", methods=["GET"])
def health():
    return jsonify({"code": 0, "message": "Campus Lost & Found API is running"})


if __name__ == "__main__":
    # host=0.0.0.0 方便真机/局域网访问; 端口默认 5000
    app.run(host="0.0.0.0", port=5000, debug=True)
