# -*- coding: utf-8 -*-
"""
校园失物招领 - 后端主程序 (MVP 版)
技术栈: Flask + flask-cors + SQLite (Flask-SQLAlchemy)
数据: backend/campus_lost_found.db（图片仍存 uploads/）
接口清单:
  POST /register            - 注册
  POST /login               - 登录
  GET  /items               - 获取失物列表 (需登录)
  POST /items               - 发布失物 (需登录, 可选带 imageUrl)
  POST /items/claim         - 认领物品 (需登录)
  POST /upload              - 上传图片 (需登录)
  GET  /uploads/<filename>  - 图片静态访问 (无需登录)
  GET  /                    - 健康检查
"""

import os
import uuid
import time
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(_BACKEND_DIR, "uploads")
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024

app = Flask(__name__)
CORS(app)

_db_file = os.path.join(_BACKEND_DIR, "campus_lost_found.db")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + _db_file.replace("\\", "/")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

db = SQLAlchemy(app)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)


class Item(db.Model):
    __tablename__ = "items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(500), nullable=False, default="")
    status = db.Column(db.String(20), nullable=False, default="未认领")
    create_time = db.Column(db.String(32), nullable=False)
    publisher = db.Column(db.String(80), nullable=False)
    claimer = db.Column(db.String(80), nullable=True)


# token -> username（进程内，重启需重新登录）
tokens = {}


def allowed_file(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def now_str():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())


def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").strip()
        if not token or token not in tokens:
            return jsonify({"code": 401, "message": "未登录或登录已失效"}), 401
        request.current_user = tokens[token]
        return func(*args, **kwargs)

    return wrapper


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"code": 1, "message": "账号和密码不能为空"})
    if len(username) < 2:
        return jsonify({"code": 1, "message": "账号不能少于2位"})
    if len(password) < 4:
        return jsonify({"code": 1, "message": "密码不能少于4位"})
    if User.query.filter_by(username=username).first():
        return jsonify({"code": 1, "message": "该账号已被注册"})

    user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    return jsonify({"code": 0, "message": "注册成功"})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"code": 1, "message": "账号和密码不能为空"})

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"code": 1, "message": "账号或密码错误"})

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
    rows = Item.query.order_by(Item.id.desc()).all()
    result = [
        {
            "id": it.id,
            "title": it.title,
            "description": it.description,
            "status": it.status,
            "createTime": it.create_time,
            "imageUrl": it.image_url or "",
        }
        for it in rows
    ]
    return jsonify({"code": 0, "message": "ok", "data": result})


@app.route("/items", methods=["POST"])
@login_required
def publish_item():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    image_url = (data.get("imageUrl") or "").strip()

    if not title:
        return jsonify({"code": 1, "message": "标题不能为空"})
    if not description:
        return jsonify({"code": 1, "message": "描述不能为空"})

    item = Item(
        title=title,
        description=description,
        image_url=image_url,
        status="未认领",
        create_time=now_str(),
        publisher=request.current_user,
        claimer=None,
    )
    db.session.add(item)
    db.session.commit()

    return jsonify({
        "code": 0,
        "message": "发布成功",
        "data": {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "imageUrl": item.image_url,
            "status": item.status,
            "createTime": item.create_time,
        },
    })


@app.route("/items/claim", methods=["POST"])
@login_required
def claim_item():
    data = request.get_json(silent=True) or {}
    item_id = data.get("id")

    if item_id is None:
        return jsonify({"code": 1, "message": "缺少物品 id"})

    try:
        item_id = int(item_id)
    except (ValueError, TypeError):
        return jsonify({"code": 1, "message": "物品 id 格式错误"})

    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.status == "已认领":
        return jsonify({"code": 1, "message": "该物品已被认领"})

    item.status = "已认领"
    item.claimer = request.current_user
    db.session.commit()
    return jsonify({"code": 0, "message": "认领成功"})


@app.route("/upload", methods=["POST"])
@login_required
def upload_image():
    if "file" not in request.files:
        return jsonify({"code": 1, "message": "未收到图片文件 (字段名应为 file)"})

    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"code": 1, "message": "图片文件为空"})

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

    image_url = "/uploads/{}".format(new_name)
    return jsonify({
        "code": 0,
        "message": "上传成功",
        "data": {"imageUrl": image_url},
    })


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/", methods=["GET"])
def health():
    return jsonify({"code": 0, "message": "Campus Lost & Found API is running"})


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
