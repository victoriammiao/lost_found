# -*- coding: utf-8 -*-
"""
校园失物招领 - 后端主程序 (MVP 版)
技术栈: Flask + flask-cors + SQLite (Flask-SQLAlchemy)
数据: backend/campus_lost_found.db（图片仍存 uploads/）
接口清单:
  POST /register            - 注册
  POST /login               - 登录
  GET  /locations           - 校区固定地点库 JSON (需登录)
  GET  /items               - 获取失物列表 (需登录)
  POST /items               - 发布失物 (需登录, 含 locationId / 可选 imageUrl)
  POST /items/claim         - 认领物品 (需登录)
  POST /upload              - 上传图片 (需登录)
  GET  /uploads/<filename>  - 图片静态访问 (无需登录)
  GET  /                    - 健康检查
"""

import json
import os
import uuid
import time
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
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

# 管理员账号（仅供校内审核；密码首次通过 _ensure_admin_user 写入）
ADMIN_USERNAME = "000"

db = SQLAlchemy(app)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    student_verified = db.Column(db.Boolean, nullable=False, default=False)
    # none / pending / approved / rejected —— 空字符串表示尚未申请或沿用下面 legacy 字段兼容
    student_verify_status = db.Column(db.String(16), nullable=False, default="")
    real_name = db.Column(db.String(40), nullable=False, default="")
    student_no = db.Column(db.String(32), nullable=False, default="")


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
    # 寻物 = 失主发帖求助；招领 = 拾主发帖等人认领
    post_type = db.Column(db.String(10), nullable=False, default="招领")
    location_id = db.Column(db.String(64), nullable=False, default="")
    location_label = db.Column(db.String(128), nullable=False, default="")
    is_draft = db.Column(db.Boolean, nullable=False, default=False)
    # 发布时可选附带 GCJ-02 或 EXIF 原始经纬度（与校区地点库独立存储）
    publish_latitude = db.Column(db.Float, nullable=True)
    publish_longitude = db.Column(db.Float, nullable=True)


# token -> username（进程内，重启需重新登录）
tokens = {}


def allowed_file(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def now_str():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())


_LOCATIONS_JSON_CACHE = None


def _locations_json_path():
    return os.path.join(_BACKEND_DIR, "data", "scnu_nanhai_locations.json")


def load_locations_payload():
    """读取南海校区地点库（进程内缓存）。"""
    global _LOCATIONS_JSON_CACHE
    if _LOCATIONS_JSON_CACHE is not None:
        return _LOCATIONS_JSON_CACHE
    path = _locations_json_path()
    if not os.path.isfile(path):
        raise FileNotFoundError("locations json missing: {}".format(path))
    with open(path, "r", encoding="utf-8") as f:
        _LOCATIONS_JSON_CACHE = json.load(f)
    return _LOCATIONS_JSON_CACHE


def _parse_optional_publish_geo(data):
    """解析 JSON 中的 publishLatitude / publishLongitude，非法则忽略。"""
    if not data:
        return None, None
    lat = data.get("publishLatitude")
    lng = data.get("publishLongitude")
    if lat is None or lng is None:
        return None, None
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return None, None
    if not (-90.0 <= lat_f <= 90.0) or not (-180.0 <= lng_f <= 180.0):
        return None, None
    return lat_f, lng_f


def resolve_location_label(place_id):
    """由地点 id 解析「分区 · 点位」展示文案；无效返回 None。"""
    if not place_id:
        return None
    try:
        data = load_locations_payload()
    except FileNotFoundError:
        return None
    for z in data.get("zones", []):
        zname = z.get("name") or ""
        for p in z.get("places", []):
            if p.get("id") == place_id:
                pname = p.get("name") or ""
                return "{} · {}".format(zname, pname)
    return None


def item_to_dict(it, publisher_student_verified=False):
    """序列化物品（列表 / 详情共用）。"""
    return {
        "id": it.id,
        "title": it.title,
        "description": it.description,
        "status": it.status,
        "createTime": it.create_time,
        "imageUrl": it.image_url or "",
        "postType": it.post_type,
        "locationId": it.location_id or "",
        "locationLabel": it.location_label or "",
        "publishLatitude": getattr(it, "publish_latitude", None),
        "publishLongitude": getattr(it, "publish_longitude", None),
        "isDraft": bool(getattr(it, "is_draft", False)),
        "publisherStudentVerified": bool(publisher_student_verified),
    }


def user_student_verify_state(user):
    """返回 canonical 状态: none | pending | approved | rejected"""
    if not user:
        return "none"
    st = (getattr(user, "student_verify_status", None) or "").strip().lower()
    if st in ("pending", "approved", "rejected"):
        return st
    if bool(user.student_verified):
        return "approved"
    return "none"


def user_passed_student_verify(user):
    return user_student_verify_state(user) == "approved"


def items_attach_publisher_verification(rows):
    """为每条物品的发布者附上「已通过学生认证」标记。"""
    publishers = list({it.publisher for it in rows})
    if not publishers:
        return []
    users_found = User.query.filter(User.username.in_(publishers)).all()
    um = {u.username: u for u in users_found}
    out = []
    for it in rows:
        pu = um.get(it.publisher)
        out.append(item_to_dict(it, publisher_student_verified=user_passed_student_verify(pu)))
    return out


def single_item_attach_verification(it):
    u = User.query.filter_by(username=it.publisher).first()
    return item_to_dict(it, publisher_student_verified=user_passed_student_verify(u))


def mask_student_no(no):
    if not no:
        return ""
    s = no.strip()
    if len(s) <= 4:
        return "****"
    return "*" * (len(s) - 4) + s[-4:]


def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").strip()
        if not token or token not in tokens:
            return jsonify({"code": 401, "message": "未登录或登录已失效"}), 401
        request.current_user = tokens[token]
        return func(*args, **kwargs)

    return wrapper


def admin_required(func):
    """必须为管理员账号登录。"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").strip()
        if not token or token not in tokens:
            return jsonify({"code": 401, "message": "未登录或登录已失效"}), 401
        request.current_user = tokens[token]
        if request.current_user != ADMIN_USERNAME:
            return jsonify({"code": 403, "message": "需要管理员权限"}), 403
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
    if username == ADMIN_USERNAME:
        return jsonify({"code": 1, "message": "该账号为系统保留账号"})

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


@app.route("/profile", methods=["GET"])
@login_required
def get_profile():
    user = User.query.filter_by(username=request.current_user).first()
    if not user:
        return jsonify({"code": 1, "message": "用户不存在"})
    st = user_student_verify_state(user)
    return jsonify({
        "code": 0,
        "message": "ok",
        "data": {
            "username": user.username,
            "studentVerified": st == "approved",
            "studentVerifyStatus": st,
            "realName": user.real_name or "",
            "studentNoMasked": mask_student_no(user.student_no or ""),
            "isAdmin": request.current_user == ADMIN_USERNAME,
        },
    })


@app.route("/profile/verify", methods=["POST"])
@login_required
def verify_student():
    """提交学生认证申请（待管理员审核）。"""
    data = request.get_json(silent=True) or {}
    real_name = (data.get("realName") or "").strip()
    student_no = (data.get("studentNo") or "").strip()
    if len(real_name) < 2:
        return jsonify({"code": 1, "message": "请填写真实姓名（至少2字）"})
    if len(student_no) < 6:
        return jsonify({"code": 1, "message": "请填写有效学号"})
    user = User.query.filter_by(username=request.current_user).first()
    if not user:
        return jsonify({"code": 1, "message": "用户不存在"})
    st = user_student_verify_state(user)
    if st == "approved":
        return jsonify({"code": 1, "message": "您已通过学生认证"})
    if st == "pending":
        return jsonify({"code": 1, "message": "已有审核中的申请，请耐心等待"})
    user.real_name = real_name
    user.student_no = student_no
    user.student_verify_status = "pending"
    user.student_verified = False
    db.session.commit()
    return jsonify({"code": 0, "message": "已提交申请，请等待管理员审核"})


@app.route("/admin/student-verifications", methods=["GET"])
@admin_required
def admin_list_pending_verifications():
    rows = (
        User.query.filter_by(student_verify_status="pending")
        .order_by(User.id.asc())
        .all()
    )
    data = [
        {
            "username": u.username,
            "realName": u.real_name or "",
            "studentNo": u.student_no or "",
        }
        for u in rows
    ]
    return jsonify({"code": 0, "message": "ok", "data": data})


@app.route("/admin/student-verifications/approve", methods=["POST"])
@admin_required
def admin_approve_student():
    data = request.get_json(silent=True) or {}
    uname = (data.get("username") or "").strip()
    if not uname:
        return jsonify({"code": 1, "message": "缺少用户名"})
    user = User.query.filter_by(username=uname).first()
    if not user:
        return jsonify({"code": 1, "message": "用户不存在"})
    if user.student_verify_status != "pending":
        return jsonify({"code": 1, "message": "该用户当前不是待审核状态"})
    user.student_verify_status = "approved"
    user.student_verified = True
    db.session.commit()
    return jsonify({"code": 0, "message": "已通过"})


@app.route("/admin/student-verifications/reject", methods=["POST"])
@admin_required
def admin_reject_student():
    data = request.get_json(silent=True) or {}
    uname = (data.get("username") or "").strip()
    if not uname:
        return jsonify({"code": 1, "message": "缺少用户名"})
    user = User.query.filter_by(username=uname).first()
    if not user:
        return jsonify({"code": 1, "message": "用户不存在"})
    if user.student_verify_status != "pending":
        return jsonify({"code": 1, "message": "该用户当前不是待审核状态"})
    user.student_verify_status = "rejected"
    user.student_verified = False
    db.session.commit()
    return jsonify({"code": 0, "message": "已驳回"})


@app.route("/locations", methods=["GET"])
@login_required
def list_locations():
    try:
        data = load_locations_payload()
    except FileNotFoundError as e:
        return jsonify({"code": 1, "message": str(e)}), 500
    return jsonify({"code": 0, "message": "ok", "data": data})


@app.route("/items/mine", methods=["GET"])
@login_required
def list_my_items():
    draft_arg = (request.args.get("draft") or "0").strip().lower()
    is_draft = draft_arg in ("1", "true", "yes")
    rows = (
        Item.query.filter_by(publisher=request.current_user, is_draft=is_draft)
        .order_by(Item.id.desc())
        .all()
    )
    return jsonify({
        "code": 0,
        "message": "ok",
        "data": items_attach_publisher_verification(rows),
    })


@app.route("/items", methods=["GET"])
@login_required
def list_items():
    rows = (
        Item.query.filter_by(is_draft=False)
        .order_by(Item.id.desc())
        .all()
    )
    return jsonify({
        "code": 0,
        "message": "ok",
        "data": items_attach_publisher_verification(rows),
    })


@app.route("/items", methods=["POST"])
@login_required
def publish_item():
    data = request.get_json(silent=True) or {}
    save_as_draft = bool(data.get("saveAsDraft"))
    plat, plng = _parse_optional_publish_geo(data)

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    image_url = (data.get("imageUrl") or "").strip()
    post_type = (data.get("postType") or "招领").strip()
    location_id = (data.get("locationId") or "").strip()

    if post_type not in ("寻物", "招领"):
        return jsonify({"code": 1, "message": "类型须为「寻物」或「招领」"})

    if save_as_draft:
        if not title and not description:
            return jsonify({"code": 1, "message": "草稿请至少填写标题或描述"})
        title = title or "（无标题草稿）"
        location_label = ""
        if location_id:
            location_label = resolve_location_label(location_id)
            if not location_label:
                return jsonify({"code": 1, "message": "地点无效，请重新选择或清空地点"})
        item = Item(
            title=title,
            description=description,
            image_url=image_url,
            status="未认领",
            create_time=now_str(),
            publisher=request.current_user,
            claimer=None,
            post_type=post_type,
            location_id=location_id,
            location_label=location_label,
            is_draft=True,
            publish_latitude=plat,
            publish_longitude=plng,
        )
        db.session.add(item)
        db.session.commit()
        return jsonify({
            "code": 0,
            "message": "草稿已保存",
            "data": single_item_attach_verification(item),
        })

    if not location_id:
        return jsonify({"code": 1, "message": "请选择校区地点"})
    location_label = resolve_location_label(location_id)
    if not location_label:
        return jsonify({"code": 1, "message": "地点无效，请重新选择"})
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
        post_type=post_type,
        location_id=location_id,
        location_label=location_label,
        is_draft=False,
        publish_latitude=plat,
        publish_longitude=plng,
    )
    db.session.add(item)
    db.session.commit()

    return jsonify({
        "code": 0,
        "message": "发布成功",
        "data": single_item_attach_verification(item),
    })


@app.route("/items/<int:item_id>", methods=["GET"])
@login_required
def get_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.publisher != request.current_user:
        return jsonify({"code": 1, "message": "无权查看"})
    return jsonify({"code": 0, "message": "ok", "data": single_item_attach_verification(item)})


@app.route("/items/<int:item_id>", methods=["PUT"])
@login_required
def update_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.publisher != request.current_user:
        return jsonify({"code": 1, "message": "无权操作"})
    if not item.is_draft:
        return jsonify({"code": 1, "message": "仅草稿可编辑"})

    data = request.get_json(silent=True) or {}
    plat, plng = _parse_optional_publish_geo(data)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    image_url = (data.get("imageUrl") or "").strip()
    post_type = (data.get("postType") or item.post_type).strip()
    location_id = (data.get("locationId") or "").strip()

    if post_type not in ("寻物", "招领"):
        return jsonify({"code": 1, "message": "类型须为「寻物」或「招领」"})
    if not title and not description:
        return jsonify({"code": 1, "message": "请至少填写标题或描述"})
    title = title or "（无标题草稿）"
    location_label = ""
    if location_id:
        location_label = resolve_location_label(location_id)
        if not location_label:
            return jsonify({"code": 1, "message": "地点无效，请重新选择或清空地点"})

    item.title = title
    item.description = description
    item.image_url = image_url
    item.post_type = post_type
    item.location_id = location_id
    item.location_label = location_label
    item.publish_latitude = plat
    item.publish_longitude = plng
    db.session.commit()
    return jsonify({"code": 0, "message": "草稿已更新", "data": single_item_attach_verification(item)})


@app.route("/items/<int:item_id>", methods=["DELETE"])
@login_required
def delete_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.publisher != request.current_user:
        return jsonify({"code": 1, "message": "无权删除"})
    db.session.delete(item)
    db.session.commit()
    return jsonify({"code": 0, "message": "已删除"})


@app.route("/items/<int:item_id>/publish", methods=["POST"])
@login_required
def publish_draft(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.publisher != request.current_user:
        return jsonify({"code": 1, "message": "无权操作"})
    if not item.is_draft:
        return jsonify({"code": 1, "message": "该记录已发布"})

    data = request.get_json(silent=True) or {}
    plat, plng = _parse_optional_publish_geo(data)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    image_url = (data.get("imageUrl") or "").strip()
    post_type = (data.get("postType") or "招领").strip()
    location_id = (data.get("locationId") or "").strip()

    if post_type not in ("寻物", "招领"):
        return jsonify({"code": 1, "message": "类型须为「寻物」或「招领」"})
    if not location_id:
        return jsonify({"code": 1, "message": "请选择校区地点"})
    location_label = resolve_location_label(location_id)
    if not location_label:
        return jsonify({"code": 1, "message": "地点无效，请重新选择"})
    if not title:
        return jsonify({"code": 1, "message": "标题不能为空"})
    if not description:
        return jsonify({"code": 1, "message": "描述不能为空"})

    item.title = title
    item.description = description
    item.image_url = image_url
    item.post_type = post_type
    item.location_id = location_id
    item.location_label = location_label
    item.publish_latitude = plat
    item.publish_longitude = plng
    item.is_draft = False
    db.session.commit()
    return jsonify({"code": 0, "message": "发布成功", "data": single_item_attach_verification(item)})


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
    if getattr(item, "is_draft", False):
        return jsonify({"code": 1, "message": "草稿不能被认领"})
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


def _ensure_post_type_column():
    """SQLite 已有库无新列时补充 post_type，避免仅 create_all 不升级表结构。"""
    insp = inspect(db.engine)
    if not insp.has_table("items"):
        return
    names = {c["name"] for c in insp.get_columns("items")}
    if "post_type" in names:
        return
    db.session.execute(
        text(
            "ALTER TABLE items ADD COLUMN post_type VARCHAR(10) NOT NULL DEFAULT '招领'"
        )
    )
    db.session.commit()


def _ensure_location_columns():
    insp = inspect(db.engine)
    if not insp.has_table("items"):
        return
    names = {c["name"] for c in insp.get_columns("items")}
    if "location_id" not in names:
        db.session.execute(
            text("ALTER TABLE items ADD COLUMN location_id VARCHAR(64) NOT NULL DEFAULT ''")
        )
    if "location_label" not in names:
        db.session.execute(
            text(
                "ALTER TABLE items ADD COLUMN location_label VARCHAR(128) NOT NULL DEFAULT ''"
            )
        )
    db.session.commit()


def _ensure_user_profile_columns():
    insp = inspect(db.engine)
    if not insp.has_table("users"):
        return
    names = {c["name"] for c in insp.get_columns("users")}
    if "student_verified" not in names:
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN student_verified BOOLEAN NOT NULL DEFAULT 0")
        )
    if "real_name" not in names:
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN real_name VARCHAR(40) NOT NULL DEFAULT ''")
        )
    if "student_no" not in names:
        db.session.execute(
            text("ALTER TABLE users ADD COLUMN student_no VARCHAR(32) NOT NULL DEFAULT ''")
        )
    db.session.commit()


def _ensure_student_verify_status_column():
    insp = inspect(db.engine)
    if not insp.has_table("users"):
        return
    names = {c["name"] for c in insp.get_columns("users")}
    if "student_verify_status" not in names:
        db.session.execute(
            text(
                "ALTER TABLE users ADD COLUMN student_verify_status VARCHAR(16) NOT NULL DEFAULT ''"
            )
        )
        db.session.commit()


def _migrate_legacy_verified_to_status():
    """旧库仅有 student_verified 标志时，同步为 approved 状态。"""
    try:
        db.session.execute(
            text(
                "UPDATE users SET student_verify_status='approved' "
                "WHERE student_verified != 0 AND "
                "(student_verify_status IS NULL OR student_verify_status = '')"
            )
        )
        db.session.commit()
    except Exception:
        db.session.rollback()


def _ensure_admin_user():
    if User.query.filter_by(username=ADMIN_USERNAME).first():
        return
    admin_u = User(
        username=ADMIN_USERNAME,
        password_hash=generate_password_hash("0000"),
        student_verified=False,
        student_verify_status="",
        real_name="",
        student_no="",
    )
    db.session.add(admin_u)
    db.session.commit()


def _ensure_is_draft_column():
    insp = inspect(db.engine)
    if not insp.has_table("items"):
        return
    names = {c["name"] for c in insp.get_columns("items")}
    if "is_draft" not in names:
        db.session.execute(
            text("ALTER TABLE items ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0")
        )
    db.session.commit()


def _ensure_publish_geo_columns():
    insp = inspect(db.engine)
    if not insp.has_table("items"):
        return
    names = {c["name"] for c in insp.get_columns("items")}
    if "publish_latitude" not in names:
        db.session.execute(text("ALTER TABLE items ADD COLUMN publish_latitude FLOAT"))
    if "publish_longitude" not in names:
        db.session.execute(text("ALTER TABLE items ADD COLUMN publish_longitude FLOAT"))
    db.session.commit()


# 旧版宿舍点位 id（JSON 改版前）→ 现行 dorm_1…，用于 SQLite 数据对齐
_LEGACY_DORM_ID_MAP = {
    "dorm_east_1": "dorm_1",
    "dorm_east_2": "dorm_2",
    "dorm_east_3": "dorm_3",
    "dorm_west_1": "dorm_4",
    "dorm_west_2": "dorm_5",
    "dorm_west_3": "dorm_6",
}

# 地点库删改 id 后，旧帖子里仍可能保存旧 id；映射到现行 id 后再按 JSON 刷新文案
_DEPRECATED_LOCATION_ID_MAP = {
    # 曾有的 dorm_8(F)/dorm_9(G) 已合并进现行 dorm_6/dorm_7 命名体系
    "dorm_8": "dorm_6",
    "dorm_9": "dorm_7",
}


def _migrate_deprecated_location_ids():
    try:
        load_locations_payload()
    except FileNotFoundError:
        return
    for old_id, new_id in _DEPRECATED_LOCATION_ID_MAP.items():
        lbl = resolve_location_label(new_id)
        if not lbl:
            continue
        Item.query.filter_by(location_id=old_id).update(
            {"location_id": new_id, "location_label": lbl},
            synchronize_session=False,
        )
    db.session.commit()


def _migrate_legacy_dorm_location_ids():
    """把仍使用旧 id 的记录改成新 id，并按当前 JSON 写入 location_label。"""
    try:
        load_locations_payload()
    except FileNotFoundError:
        return
    for old_id, new_id in _LEGACY_DORM_ID_MAP.items():
        lbl = resolve_location_label(new_id)
        if not lbl:
            continue
        Item.query.filter_by(location_id=old_id).update(
            {"location_id": new_id, "location_label": lbl},
            synchronize_session=False,
        )
    db.session.commit()


def _sync_item_location_labels_from_json():
    """按当前 data/scnu_nanhai_locations.json 刷新每条物品的展示文案，与地点表一致。"""
    global _LOCATIONS_JSON_CACHE
    _LOCATIONS_JSON_CACHE = None
    try:
        load_locations_payload()
    except FileNotFoundError:
        return
    rows = Item.query.filter(Item.location_id != "").all()
    changed = False
    for it in rows:
        lbl = resolve_location_label(it.location_id)
        if lbl is not None and it.location_label != lbl:
            it.location_label = lbl
            changed = True
    if changed:
        db.session.commit()


with app.app_context():
    db.create_all()
    _ensure_post_type_column()
    _ensure_location_columns()
    _ensure_user_profile_columns()
    _ensure_student_verify_status_column()
    _migrate_legacy_verified_to_status()
    _ensure_admin_user()
    _ensure_is_draft_column()
    _ensure_publish_geo_columns()
    _migrate_legacy_dorm_location_ids()
    _migrate_deprecated_location_ids()
    _sync_item_location_labels_from_json()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
