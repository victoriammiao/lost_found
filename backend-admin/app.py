# -*- coding: utf-8 -*-
"""
校园失物招领 - 后端主程序 (MVP 版)
技术栈: Flask + flask-cors + SQLite (Flask-SQLAlchemy)
数据: backend/campus_lost_found.db（图片仍存 uploads/）

接口清单:
  POST /register            - 注册
  POST /login               - 登录
  GET  /locations           - 校区固定地点库 JSON (需登录)
  GET  /items               - 获取已审核通过的失物列表 (需登录，不含发帖人联系方式)
  POST /items               - 发布失物 (正式提交为待审核 pending)
  GET  /items/<id>/peek     - 帖摘要（提交线索页）
  POST /items/<id>/clues    - 提交线索（联系方式仅管理员可见）
  GET  /admin/clues         - 待处理线索列表 (管理员)
  POST /admin/clues/match|reject - 采纳/拒绝线索 (管理员)
  GET  /admin/items/pending - 待审核失物列表 (管理员)
  POST /admin/items/approve|reject|delete - 失物审核 (管理员)
  POST /upload              - 上传图片 (需登录)
  GET  /uploads/<filename>   - 图片静态访问 (无需登录)
  GET  /                    - 健康检查

管理员后台接口:
  POST /admin/login         - 管理员登录
  POST /admin/logout        - 管理员登出
  GET  /admin/check         - 验证管理员token
  GET  /admin/users         - 用户列表（分页+筛选）
  GET  /admin/users/:username/items - 用户发布记录
  POST /admin/users/:username/ban - 封禁用户
  POST /admin/users/:username/unban - 解封用户
  GET  /admin/items         - 所有物品（分页+筛选）
  PUT  /admin/items/:id     - 编辑物品
  PUT  /admin/items/:id/review - 审核物品
  POST /admin/items/batch/review - 批量审核
  POST /admin/items/batch/delete - 批量删除
  GET  /admin/stats/overview - 总览统计
  GET  /admin/stats/trend   - 发布趋势
  GET  /admin/stats/distribution - 分布统计
  GET  /admin/clues/all     - 所有线索列表
  GET  /admin/clues/:id     - 线索详情
  GET  /admin/student-verifications - 学生认证列表
  POST /admin/student-verifications/batch - 批量审核认证
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

# 使用用户端的数据库
_lost_found_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 回到失物招领小组项目根目录
_lost_found_backend = os.path.join(_lost_found_dir, "lost_found-main", "校园失物招领小程序", "campus-lost-found", "backend")
_db_file = os.path.join(_lost_found_backend, "campus_lost_found.db")
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
    # 失物帖审核：pending 待审 | approved 已上线 | rejected 已拒绝（仅本人可见/可删）
    review_status = db.Column(db.String(16), nullable=False, default="approved")
    contact = db.Column(db.String(80), nullable=False, default="")
    resolved_clue_id = db.Column(db.Integer, nullable=True)


class ItemClue(db.Model):
    """寻物/招领帖下的「捡到线索」或「失主线索」，联系方式仅管理员可见。"""

    __tablename__ = "item_clues"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    item_id = db.Column(db.Integer, db.ForeignKey("items.id"), nullable=False, index=True)
    submitter = db.Column(db.String(80), nullable=False)
    contact = db.Column(db.String(80), nullable=False)
    found_location = db.Column(db.String(200), nullable=False, default="")
    found_time = db.Column(db.String(80), nullable=False, default="")
    description = db.Column(db.Text, nullable=False, default="")
    image_url = db.Column(db.String(500), nullable=False, default="")
    # pending 待管理员处理 | matched 已采纳 | rejected 已拒绝
    status = db.Column(db.String(16), nullable=False, default="pending")
    create_time = db.Column(db.String(32), nullable=False)


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


def _item_review_status(it):
    return (getattr(it, "review_status", None) or "approved").strip().lower() or "approved"


def item_to_dict(it, publisher_student_verified=False, include_contact=False):
    """序列化物品（列表 / 详情共用）。首页等公开场景 include_contact=False，不返回发帖人联系方式。"""
    rs = _item_review_status(it)
    contact_val = ""
    if include_contact:
        contact_val = (getattr(it, "contact", None) or "") or ""
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
        "reviewStatus": rs,
        "contact": contact_val,
    }


def item_to_admin_moderation_dict(it):
    """管理员审核列表用（含发布者、联系方式）。"""
    d = item_to_dict(it, publisher_student_verified=False, include_contact=True)
    d["publisher"] = it.publisher
    return d


def clue_to_admin_dict(clue, item):
    """管理员查看线索（含发帖人、提交人双方联系方式，仅管理端使用）。"""
    return {
        "id": clue.id,
        "itemId": item.id,
        "itemTitle": item.title,
        "itemPostType": item.post_type,
        "itemPublisher": item.publisher,
        "posterContact": (getattr(item, "contact", None) or "") or "",
        "submitter": clue.submitter,
        "contact": clue.contact or "",
        "foundLocation": clue.found_location or "",
        "foundTime": clue.found_time or "",
        "description": clue.description or "",
        "imageUrl": clue.image_url or "",
        "status": clue.status,
        "createTime": clue.create_time,
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


def items_attach_publisher_verification(rows, include_contact=False):
    """为每条物品的发布者附上「已通过学生认证」标记。"""
    publishers = list({it.publisher for it in rows})
    if not publishers:
        return []
    users_found = User.query.filter(User.username.in_(publishers)).all()
    um = {u.username: u for u in users_found}
    out = []
    for it in rows:
        pu = um.get(it.publisher)
        out.append(
            item_to_dict(
                it,
                publisher_student_verified=user_passed_student_verify(pu),
                include_contact=include_contact,
            )
        )
    return out


def single_item_attach_verification(it, include_contact=False):
    u = User.query.filter_by(username=it.publisher).first()
    return item_to_dict(
        it,
        publisher_student_verified=user_passed_student_verify(u),
        include_contact=include_contact,
    )


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
        "data": items_attach_publisher_verification(rows, include_contact=True),
    })


@app.route("/items", methods=["GET"])
@login_required
def list_items():
    rows = (
        Item.query.filter_by(is_draft=False, review_status="approved")
        .order_by(Item.create_time.desc(), Item.id.desc())
        .all()
    )
    return jsonify({
        "code": 0,
        "message": "ok",
        "data": items_attach_publisher_verification(rows, include_contact=False),
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
        contact_draft = (data.get("contact") or "").strip()[:80]
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
            review_status="approved",
            contact=contact_draft,
        )
        db.session.add(item)
        db.session.commit()
        return jsonify({
            "code": 0,
            "message": "草稿已保存",
            "data": single_item_attach_verification(item, include_contact=True),
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

    contact = (data.get("contact") or "").strip()
    if len(contact) < 3:
        return jsonify({"code": 1, "message": "请填写联系方式（手机/微信号等，至少3位）"})
    contact = contact[:80]

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
        review_status="pending",
        contact=contact,
    )
    db.session.add(item)
    db.session.commit()

    return jsonify({
        "code": 0,
        "message": "已提交审核，管理员通过后将出现在首页",
        "data": single_item_attach_verification(item, include_contact=True),
    })


@app.route("/items/<int:item_id>", methods=["GET"])
@login_required
def get_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.publisher != request.current_user:
        return jsonify({"code": 1, "message": "无权查看"})
    return jsonify(
        {"code": 0, "message": "ok", "data": single_item_attach_verification(item, include_contact=True)}
    )


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
    if "contact" in data:
        item.contact = (data.get("contact") or "").strip()[:80]
    db.session.commit()
    return jsonify(
        {"code": 0, "message": "草稿已更新", "data": single_item_attach_verification(item, include_contact=True)}
    )


@app.route("/items/<int:item_id>", methods=["DELETE"])
@login_required
def delete_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"code": 1, "message": "物品不存在"})
    if item.publisher != request.current_user:
        return jsonify({"code": 1, "message": "无权删除"})
    ItemClue.query.filter_by(item_id=item.id).delete(synchronize_session=False)
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

    contact = (data.get("contact") or "").strip()
    if len(contact) < 3:
        return jsonify({"code": 1, "message": "请填写联系方式（手机/微信号等，至少3位）"})
    contact = contact[:80]

    item.title = title
    item.description = description
    item.image_url = image_url
    item.post_type = post_type
    item.location_id = location_id
    item.location_label = location_label
    item.publish_latitude = plat
    item.publish_longitude = plng
    item.contact = contact
    item.review_status = "pending"
    item.is_draft = False
    db.session.commit()
    return jsonify({
        "code": 0,
        "message": "已提交审核，管理员通过后将出现在首页",
        "data": single_item_attach_verification(item, include_contact=True),
    })


@app.route("/items/<int:item_id>/peek", methods=["GET"])
@login_required
def peek_item_for_clue(item_id):
    """已登录用户查看帖摘要（用于提交线索页），不含发帖人联系方式。"""
    item = Item.query.get(item_id)
    if not item or item.is_draft or _item_review_status(item) != "approved":
        return jsonify({"code": 1, "message": "信息不存在或未上架"})
    if item.status == "已认领":
        return jsonify({"code": 1, "message": "该帖已闭环，不再接收线索"})
    return jsonify({
        "code": 0,
        "message": "ok",
        "data": {
            "id": item.id,
            "title": item.title,
            "postType": item.post_type,
            "locationLabel": item.location_label or "",
            "status": item.status,
        },
    })


@app.route("/items/<int:item_id>/clues", methods=["POST"])
@login_required
def submit_item_clue(item_id):
    """提交一条线索（多人可提交）；联系方式仅管理员可见。"""
    item = Item.query.get(item_id)
    if not item or item.is_draft or _item_review_status(item) != "approved":
        return jsonify({"code": 1, "message": "信息不存在或未上架"})
    if item.status == "已认领":
        return jsonify({"code": 1, "message": "该帖已闭环"})
    if item.publisher == request.current_user:
        return jsonify({"code": 1, "message": "不能给自己的帖子提交线索"})

    dup = (
        ItemClue.query.filter_by(
            item_id=item.id,
            submitter=request.current_user,
            status="pending",
        ).first()
    )
    if dup:
        return jsonify({"code": 1, "message": "您已有一条待审核线索，请等待管理员处理"})

    data = request.get_json(silent=True) or {}
    contact = (data.get("contact") or "").strip()
    if len(contact) < 3:
        return jsonify({"code": 1, "message": "请填写您的联系方式（至少3字），仅管理员可见"})
    contact = contact[:80]
    found_location = (data.get("foundLocation") or "").strip()[:200]
    found_time = (data.get("foundTime") or "").strip()[:80]
    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"code": 1, "message": "请填写线索描述"})
    if len(description) > 2000:
        description = description[:2000]
    image_url = (data.get("imageUrl") or "").strip()[:500]

    clue = ItemClue(
        item_id=item.id,
        submitter=request.current_user,
        contact=contact,
        found_location=found_location,
        found_time=found_time,
        description=description,
        image_url=image_url,
        status="pending",
        create_time=now_str(),
    )
    db.session.add(clue)
    db.session.commit()
    return jsonify({"code": 0, "message": "线索已提交，请等待管理员核对", "data": {"id": clue.id}})


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


# ========== 注册管理员后台扩展路由 ==========
def register_admin_routes():
    """延迟注册管理员后台路由，避免循环导入"""
    import uuid
    from functools import wraps
    from flask import request, jsonify
    from sqlalchemy import func, and_, or_
    from werkzeug.security import check_password_hash
    from datetime import datetime, timedelta
    
    # 创建管理员专用token存储
    _admin_tokens = {}
    
    def _admin_required(func):
        """必须为管理员账号登录。"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization", "").strip()
            if not token or token not in _admin_tokens:
                return jsonify({"code": 401, "message": "未登录或登录已失效"}), 401
            request.current_user = _admin_tokens[token]
            if request.current_user != ADMIN_USERNAME:
                return jsonify({"code": 403, "message": "需要管理员权限"}), 403
            return func(*args, **kwargs)
        return wrapper
    
    def _mask_student_no(no):
        """脱敏学号"""
        if not no:
            return ""
        s = no.strip()
        if len(s) <= 4:
            return "****"
        return "*" * (len(s) - 4) + s[-4:]
    
    def _item_review_status(it):
        """获取物品审核状态"""
        return (getattr(it, "review_status", None) or "approved").strip().lower() or "approved"
    
    # ========== 线索管理（待处理） ==========
    @app.route("/admin/clues", methods=["GET"])
    @_admin_required
    def admin_list_pending_clues():
        """获取待处理线索列表"""
        rows = (
            ItemClue.query.filter_by(status="pending")
            .order_by(ItemClue.item_id.asc(), ItemClue.id.asc())
            .all()
        )
        out = []
        for c in rows:
            it = Item.query.get(c.item_id)
            if it and not it.is_draft and _item_review_status(it) == "approved":
                out.append(clue_to_admin_dict(c, it))
        return jsonify({"code": 0, "message": "ok", "data": out})

    @app.route("/admin/clues/match", methods=["POST"])
    @_admin_required
    def admin_match_clue():
        """采纳线索"""
        data = request.get_json(silent=True) or {}
        try:
            clue_id = int(data.get("id"))
        except (TypeError, ValueError):
            return jsonify({"code": 1, "message": "缺少或非法的线索 id"})
        clue = ItemClue.query.get(clue_id)
        if not clue or clue.status != "pending":
            return jsonify({"code": 1, "message": "线索不存在或已处理"})
        item = Item.query.get(clue.item_id)
        if not item or item.is_draft:
            return jsonify({"code": 1, "message": "关联帖子不存在"})
        if item.status == "已认领":
            return jsonify({"code": 1, "message": "该帖已标记为已认领"})

        clue.status = "matched"
        item.status = "已认领"
        item.claimer = clue.submitter
        item.resolved_clue_id = clue.id
        others = ItemClue.query.filter(
            ItemClue.item_id == item.id,
            ItemClue.id != clue.id,
            ItemClue.status == "pending",
        ).all()
        for o in others:
            o.status = "rejected"
        db.session.commit()
        return jsonify({"code": 0, "message": "已采纳该线索并关闭本帖其他待处理线索"})

    @app.route("/admin/clues/reject", methods=["POST"])
    @_admin_required
    def admin_reject_clue():
        """拒绝线索"""
        data = request.get_json(silent=True) or {}
        try:
            clue_id = int(data.get("id"))
        except (TypeError, ValueError):
            return jsonify({"code": 1, "message": "缺少或非法的线索 id"})
        clue = ItemClue.query.get(clue_id)
        if not clue:
            return jsonify({"code": 1, "message": "线索不存在"})
        if clue.status != "pending":
            return jsonify({"code": 1, "message": "该线索不是待处理状态"})
        clue.status = "rejected"
        db.session.commit()
        return jsonify({"code": 0, "message": "已拒绝该线索"})
    
    # ========== 管理员登录 ==========
    @app.route("/admin/login", methods=["POST"])
    def admin_login():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = (data.get("password") or "").strip()

        if not username or not password:
            return jsonify({"code": 1, "message": "账号和密码不能为空"})
        
        # 验证管理员账号
        if username != ADMIN_USERNAME:
            return jsonify({"code": 1, "message": "账号或密码错误"})
        
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"code": 1, "message": "账号或密码错误"})
        
        # 验证密码
        if not check_password_hash(user.password_hash, password):
            return jsonify({"code": 1, "message": "账号或密码错误"})

        token = "admin-" + uuid.uuid4().hex
        _admin_tokens[token] = username
        return jsonify({
            "code": 0,
            "message": "登录成功",
            "token": token,
            "username": username,
        })
    
    # ========== 管理员登出 ==========
    @app.route("/admin/logout", methods=["POST"])
    @_admin_required
    def admin_logout():
        token = request.headers.get("Authorization", "").strip()
        if token in _admin_tokens:
            del _admin_tokens[token]
        return jsonify({"code": 0, "message": "已退出登录"})
    
    # ========== 管理员验证token ==========
    @app.route("/admin/check", methods=["GET"])
    def admin_check():
        token = request.headers.get("Authorization", "").strip()
        if token and token in _admin_tokens:
            return jsonify({
                "code": 0,
                "message": "ok",
                "data": {
                    "username": _admin_tokens[token],
                    "isAdmin": True
                }
            })
        return jsonify({"code": 401, "message": "未登录"})
    
    # ========== 用户管理 ==========
    @app.route("/admin/users", methods=["GET"])
    @_admin_required
    def admin_list_users():
        """获取用户列表（分页+筛选）"""
        page = request.args.get("page", 1, type=int)
        page_size = request.args.get("pageSize", 10, type=int)
        keyword = request.args.get("keyword", "").strip()
        verify_status = request.args.get("verifyStatus", "").strip()
        
        query = User.query
        
        # 关键词筛选（用户名）
        if keyword:
            query = query.filter(User.username.like(f"%{keyword}%"))
        
        # 学生认证状态筛选
        if verify_status:
            query = query.filter(User.student_verify_status == verify_status)
        
        # 排除管理员账号
        query = query.filter(User.username != ADMIN_USERNAME)
        
        # 统计总数
        total = query.count()
        
        # 分页
        offset = (page - 1) * page_size
        users = query.order_by(User.id.desc()).offset(offset).limit(page_size).all()
        
        data = []
        for u in users:
            # 统计用户发布的物品数
            item_count = Item.query.filter_by(publisher=u.username).count()
            # 统计待审核物品数
            pending_count = Item.query.filter_by(
                publisher=u.username, 
                review_status="pending"
            ).count()
            
            data.append({
                "id": u.id,
                "username": u.username,
                "studentVerified": u.student_verified,
                "studentVerifyStatus": u.student_verify_status or "none",
                "realName": u.real_name or "",
                "studentNoMasked": _mask_student_no(u.student_no or ""),
                "studentNo": u.student_no or "",
                "itemCount": item_count,
                "pendingCount": pending_count,
                "createdAt": getattr(u, 'create_time', '') or "",
            })
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "list": data,
                "total": total,
                "page": page,
                "pageSize": page_size
            }
        })
    
    @app.route("/admin/users/<username>/items", methods=["GET"])
    @_admin_required
    def admin_list_user_items(username):
        """获取用户发布的物品列表"""
        page = request.args.get("page", 1, type=int)
        page_size = request.args.get("pageSize", 10, type=int)
        
        query = Item.query.filter_by(publisher=username)
        total = query.count()
        
        offset = (page - 1) * page_size
        items = query.order_by(Item.id.desc()).offset(offset).limit(page_size).all()
        
        data = []
        for it in items:
            data.append({
                "id": it.id,
                "title": it.title,
                "description": it.description,
                "imageUrl": it.image_url or "",
                "status": it.status,
                "createTime": it.create_time,
                "postType": it.post_type,
                "locationLabel": it.location_label or "",
                "reviewStatus": _item_review_status(it),
                "contact": it.contact or "",
            })
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "list": data,
                "total": total,
                "page": page,
                "pageSize": page_size
            }
        })
    
    @app.route("/admin/users/<username>/ban", methods=["POST"])
    @_admin_required
    def admin_ban_user(username):
        """封禁用户"""
        if username == ADMIN_USERNAME:
            return jsonify({"code": 1, "message": "不能封禁管理员账号"})
        
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"code": 1, "message": "用户不存在"})
        
        return jsonify({"code": 0, "message": "用户已记录（此版本暂不支持封禁功能）"})
    
    @app.route("/admin/users/<username>/unban", methods=["POST"])
    @_admin_required
    def admin_unban_user(username):
        """解封用户"""
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"code": 1, "message": "用户不存在"})
        
        return jsonify({"code": 0, "message": "用户已记录"})
    
    # ========== 物品管理 ==========
    @app.route("/admin/items", methods=["GET"])
    @_admin_required
    def admin_list_all_items():
        """获取所有物品列表（含筛选）"""
        page = request.args.get("page", 1, type=int)
        page_size = request.args.get("pageSize", 10, type=int)
        post_type = request.args.get("postType", "").strip()
        status = request.args.get("status", "").strip()
        review_status = request.args.get("reviewStatus", "").strip()
        keyword = request.args.get("keyword", "").strip()
        start_date = request.args.get("startDate", "").strip()
        end_date = request.args.get("endDate", "").strip()
        
        query = Item.query
        
        # 筛选条件
        if post_type:
            query = query.filter(Item.post_type == post_type)
        if status:
            query = query.filter(Item.status == status)
        if review_status:
            query = query.filter(Item.review_status == review_status)
        if keyword:
            query = query.filter(
                or_(
                    Item.title.like(f"%{keyword}%"),
                    Item.description.like(f"%{keyword}%")
                )
            )
        if start_date:
            query = query.filter(Item.create_time >= start_date)
        if end_date:
            query = query.filter(Item.create_time <= end_date)
        
        total = query.count()
        
        offset = (page - 1) * page_size
        items = query.order_by(Item.id.desc()).offset(offset).limit(page_size).all()
        
        data = []
        for it in items:
            # 获取该物品的线索数
            clue_count = ItemClue.query.filter_by(item_id=it.id).count()
            
            data.append({
                "id": it.id,
                "title": it.title,
                "description": it.description,
                "imageUrl": it.image_url or "",
                "status": it.status,
                "createTime": it.create_time,
                "postType": it.post_type,
                "locationId": it.location_id or "",
                "locationLabel": it.location_label or "",
                "reviewStatus": _item_review_status(it),
                "contact": it.contact or "",
                "publisher": it.publisher,
                "claimr": it.claimer or "",
                "clueCount": clue_count,
                "isDraft": getattr(it, 'is_draft', False),
            })
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "list": data,
                "total": total,
                "page": page,
                "pageSize": page_size
            }
        })
    
    @app.route("/admin/items/<int:item_id>", methods=["PUT"])
    @_admin_required
    def admin_update_item(item_id):
        """管理员编辑物品"""
        item = Item.query.get(item_id)
        if not item:
            return jsonify({"code": 1, "message": "物品不存在"})
        
        data = request.get_json(silent=True) or {}
        
        if "title" in data:
            item.title = data.get("title", "").strip()
        if "description" in data:
            item.description = data.get("description", "").strip()
        if "status" in data:
            item.status = data.get("status", "")
        if "contact" in data:
            item.contact = data.get("contact", "").strip()[:80]
        if "locationLabel" in data:
            item.location_label = data.get("locationLabel", "")
        
        db.session.commit()
        return jsonify({
            "code": 0,
            "message": "更新成功",
            "data": {
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "status": item.status,
                "contact": item.contact or "",
            }
        })
    
    @app.route("/admin/items/<int:item_id>/review", methods=["PUT"])
    @_admin_required
    def admin_review_item(item_id):
        """审核物品（通过/拒绝）"""
        item = Item.query.get(item_id)
        if not item or getattr(item, 'is_draft', False):
            return jsonify({"code": 1, "message": "物品不存在或为草稿"})
        
        data = request.get_json(silent=True) or {}
        action = data.get("action", "").strip()
        
        if action not in ("approve", "reject"):
            return jsonify({"code": 1, "message": "无效的审核操作"})
        
        if _item_review_status(item) not in ("pending",):
            return jsonify({"code": 1, "message": "该物品当前不是待审核状态"})
        
        if action == "approve":
            item.review_status = "approved"
            message = "已通过审核"
        else:
            item.review_status = "rejected"
            message = "已拒绝"
        
        db.session.commit()
        return jsonify({"code": 0, "message": message})
    
    @app.route("/admin/items/batch/review", methods=["POST"])
    @_admin_required
    def admin_batch_review_items():
        """批量审核物品"""
        data = request.get_json(silent=True) or {}
        item_ids = data.get("ids", [])
        action = data.get("action", "").strip()
        
        if not item_ids:
            return jsonify({"code": 1, "message": "请选择要审核的物品"})
        if action not in ("approve", "reject"):
            return jsonify({"code": 1, "message": "无效的审核操作"})
        
        updated = 0
        for item_id in item_ids:
            item = Item.query.get(item_id)
            if item and getattr(item, 'is_draft', False) == False:
                if _item_review_status(item) == "pending":
                    item.review_status = "approved" if action == "approve" else "rejected"
                    updated += 1
        
        db.session.commit()
        return jsonify({
            "code": 0, 
            "message": f"已更新 {updated} 条记录的审核状态",
            "data": {"updated": updated}
        })
    
    @app.route("/admin/items/batch/delete", methods=["POST"])
    @_admin_required
    def admin_batch_delete_items():
        """批量删除物品"""
        data = request.get_json(silent=True) or {}
        item_ids = data.get("ids", [])
        
        if not item_ids:
            return jsonify({"code": 1, "message": "请选择要删除的物品"})
        
        deleted = 0
        for item_id in item_ids:
            item = Item.query.get(item_id)
            if item:
                # 同时删除关联的线索
                ItemClue.query.filter_by(item_id=item.id).delete(synchronize_session=False)
                db.session.delete(item)
                deleted += 1
        
        db.session.commit()
        return jsonify({
            "code": 0, 
            "message": f"已删除 {deleted} 条记录",
            "data": {"deleted": deleted}
        })
    
    # ========== 数据统计 ==========
    @app.route("/admin/stats/overview", methods=["GET"])
    @_admin_required
    def admin_stats_overview():
        """总览统计"""
        total_items = Item.query.filter_by(is_draft=False).count()
        pending_items = Item.query.filter_by(is_draft=False, review_status="pending").count()
        approved_items = Item.query.filter_by(is_draft=False, review_status="approved").count()
        rejected_items = Item.query.filter_by(is_draft=False, review_status="rejected").count()
        claimed_items = Item.query.filter_by(is_draft=False, status="已认领").count()
        total_users = User.query.filter(User.username != ADMIN_USERNAME).count()
        pending_verifications = User.query.filter(
            User.username != ADMIN_USERNAME,
            User.student_verify_status == "pending"
        ).count()
        pending_clues = ItemClue.query.filter_by(status="pending").count()
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "totalItems": total_items,
                "pendingItems": pending_items,
                "approvedItems": approved_items,
                "rejectedItems": rejected_items,
                "claimedItems": claimed_items,
                "totalUsers": total_users,
                "pendingVerifications": pending_verifications,
                "pendingClues": pending_clues,
                "claimRate": round(claimed_items / approved_items * 100, 1) if approved_items > 0 else 0
            }
        })
    
    @app.route("/admin/stats/trend", methods=["GET"])
    @_admin_required
    def admin_stats_trend():
        """发布趋势（近30天）"""
        days = request.args.get("days", 30, type=int)
        days = min(days, 90)  # 最多90天
        
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = (today - timedelta(days=days-1)).strftime("%Y-%m-%d")
        
        # 获取日期范围内的物品发布数据
        items = Item.query.filter(
            Item.is_draft == False,
            Item.create_time >= start_date
        ).all()
        
        # 按日期分组统计
        date_stats = {}
        for i in range(days):
            d = (today - timedelta(days=days-1-i)).strftime("%Y-%m-%d")
            date_stats[d] = {"date": d, "total": 0, "lost": 0, "found": 0}
        
        for item in items:
            date_str = item.create_time[:10] if len(item.create_time) >= 10 else ""
            if date_str in date_stats:
                date_stats[date_str]["total"] += 1
                if item.post_type == "寻物":
                    date_stats[date_str]["lost"] += 1
                else:
                    date_stats[date_str]["found"] += 1
        
        # 转换为列表
        trend_data = list(date_stats.values())
        
        # 计算总计
        total_count = sum(d["total"] for d in trend_data)
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "list": trend_data,
                "total": total_count,
                "days": days
            }
        })
    
    @app.route("/admin/stats/distribution", methods=["GET"])
    @_admin_required
    def admin_stats_distribution():
        """分布统计"""
        # 物品类型分布
        lost_count = Item.query.filter_by(is_draft=False, post_type="寻物", review_status="approved").count()
        found_count = Item.query.filter_by(is_draft=False, post_type="招领", review_status="approved").count()
        
        # 审核状态分布
        pending_count = Item.query.filter_by(is_draft=False, review_status="pending").count()
        approved_count = Item.query.filter_by(is_draft=False, review_status="approved").count()
        rejected_count = Item.query.filter_by(is_draft=False, review_status="rejected").count()
        
        # 认领状态分布
        unclaimed_count = Item.query.filter_by(is_draft=False, review_status="approved", status="未认领").count()
        claimed_count = Item.query.filter_by(is_draft=False, status="已认领").count()
        
        # 学生认证分布
        verified_users = User.query.filter(
            User.username != ADMIN_USERNAME,
            User.student_verify_status == "approved"
        ).count()
        pending_users = User.query.filter(
            User.username != ADMIN_USERNAME,
            User.student_verify_status == "pending"
        ).count()
        normal_users = User.query.filter(
            User.username != ADMIN_USERNAME,
            User.student_verify_status.in_(["", "none", None])
        ).count()
        rejected_users = User.query.filter(
            User.username != ADMIN_USERNAME,
            User.student_verify_status == "rejected"
        ).count()
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "postType": [
                    {"name": "寻物", "value": lost_count},
                    {"name": "招领", "value": found_count}
                ],
                "reviewStatus": [
                    {"name": "待审核", "value": pending_count},
                    {"name": "已通过", "value": approved_count},
                    {"name": "已拒绝", "value": rejected_count}
                ],
                "claimStatus": [
                    {"name": "未认领", "value": unclaimed_count},
                    {"name": "已认领", "value": claimed_count}
                ],
                "userVerify": [
                    {"name": "已认证", "value": verified_users},
                    {"name": "待审核", "value": pending_users},
                    {"name": "未认证", "value": normal_users},
                    {"name": "已拒绝", "value": rejected_users}
                ]
            }
        })
    
    # ========== 线索管理 ==========
    @app.route("/admin/clues/all", methods=["GET"])
    @_admin_required
    def admin_list_all_clues():
        """获取所有线索列表（含状态筛选）"""
        page = request.args.get("page", 1, type=int)
        page_size = request.args.get("pageSize", 10, type=int)
        status = request.args.get("status", "").strip()
        
        query = ItemClue.query
        
        if status:
            query = query.filter(ItemClue.status == status)
        
        total = query.count()
        
        offset = (page - 1) * page_size
        clues = query.order_by(ItemClue.id.desc()).offset(offset).limit(page_size).all()
        
        data = []
        for clue in clues:
            item = Item.query.get(clue.item_id)
            if item:
                data.append({
                    "id": clue.id,
                    "itemId": item.id,
                    "itemTitle": item.title,
                    "itemPostType": item.post_type,
                    "itemPublisher": item.publisher,
                    "posterContact": item.contact or "",
                    "submitter": clue.submitter,
                    "contact": clue.contact or "",
                    "foundLocation": clue.found_location or "",
                    "foundTime": clue.found_time or "",
                    "description": clue.description or "",
                    "imageUrl": clue.image_url or "",
                    "status": clue.status,
                    "createTime": clue.create_time,
                })
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "list": data,
                "total": total,
                "page": page,
                "pageSize": page_size
            }
        })
    
    @app.route("/admin/clues/<int:clue_id>", methods=["GET"])
    @_admin_required
    def admin_get_clue(clue_id):
        """获取线索详情"""
        clue = ItemClue.query.get(clue_id)
        if not clue:
            return jsonify({"code": 1, "message": "线索不存在"})
        
        item = Item.query.get(clue.item_id)
        if not item:
            return jsonify({"code": 1, "message": "关联物品不存在"})
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "id": clue.id,
                "itemId": item.id,
                "itemTitle": item.title,
                "itemPostType": item.post_type,
                "itemPublisher": item.publisher,
                "posterContact": item.contact or "",
                "submitter": clue.submitter,
                "contact": clue.contact or "",
                "foundLocation": clue.found_location or "",
                "foundTime": clue.found_time or "",
                "description": clue.description or "",
                "imageUrl": clue.image_url or "",
                "status": clue.status,
                "createTime": clue.create_time,
            }
        })
    
    # ========== 学生认证管理 ==========
    @app.route("/admin/student-verifications", methods=["GET"])
    @_admin_required
    def admin_list_verifications():
        """获取学生认证申请列表"""
        page = request.args.get("page", 1, type=int)
        page_size = request.args.get("pageSize", 10, type=int)
        status = request.args.get("status", "").strip()
        
        query = User.query.filter(User.username != ADMIN_USERNAME)
        
        if status:
            query = query.filter(User.student_verify_status == status)
        else:
            # 默认显示待审核的
            query = query.filter(User.student_verify_status == "pending")
        
        total = query.count()
        
        offset = (page - 1) * page_size
        users = query.order_by(User.id.desc()).offset(offset).limit(page_size).all()
        
        data = []
        for u in users:
            data.append({
                "username": u.username,
                "realName": u.real_name or "",
                "studentNo": u.student_no or "",
                "studentVerifyStatus": u.student_verify_status,
                "createdAt": getattr(u, 'create_time', '') or "",
            })
        
        return jsonify({
            "code": 0,
            "message": "ok",
            "data": {
                "list": data,
                "total": total,
                "page": page,
                "pageSize": page_size
            }
        })
    
    @app.route("/admin/student-verifications/batch", methods=["POST"])
    @_admin_required
    def admin_batch_verify():
        """批量审核学生认证"""
        data = request.get_json(silent=True) or {}
        usernames = data.get("usernames", [])
        action = data.get("action", "").strip()
        
        if not usernames:
            return jsonify({"code": 1, "message": "请选择要审核的用户"})
        if action not in ("approve", "reject"):
            return jsonify({"code": 1, "message": "无效的审核操作"})
        
        updated = 0
        for username in usernames:
            user = User.query.filter_by(username=username).first()
            if user and user.student_verify_status == "pending":
                if action == "approve":
                    user.student_verify_status = "approved"
                    user.student_verified = True
                else:
                    user.student_verify_status = "rejected"
                    user.student_verified = False
                updated += 1
        
        db.session.commit()
        return jsonify({
            "code": 0,
            "message": f"已更新 {updated} 条记录",
            "data": {"updated": updated}
        })
    
    @app.route("/admin/student-verifications/approve", methods=["POST"])
    @_admin_required
    def admin_approve_student():
        """通过学生认证"""
        data = request.get_json(silent=True) or {}
        uname = (data.get("username") or "").strip()
        if not uname:
            return jsonify({"code": 1, "message": "缺少用户名"})
        user = User.query.filter_by(username=uname).first()
        if not user:
            return jsonify({"code": 1, "message": "用户不存在"})
        if user.student_verify_status == "approved":
            return jsonify({"code": 1, "message": "该用户已通过认证"})
        user.student_verify_status = "approved"
        user.student_verified = True
        db.session.commit()
        return jsonify({"code": 0, "message": "已通过认证"})

    @app.route("/admin/student-verifications/reject", methods=["POST"])
    @_admin_required
    def admin_reject_student():
        """拒绝学生认证"""
        data = request.get_json(silent=True) or {}
        uname = (data.get("username") or "").strip()
        if not uname:
            return jsonify({"code": 1, "message": "缺少用户名"})
        user = User.query.filter_by(username=uname).first()
        if not user:
            return jsonify({"code": 1, "message": "用户不存在"})
        user.student_verify_status = "rejected"
        user.student_verified = False
        db.session.commit()
        return jsonify({"code": 0, "message": "已驳回认证申请"})


# ========== 初始化数据库 ==========
def init_db():
    """初始化数据库表"""
    db.create_all()


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
        db.session.execute(
            text("ALTER TABLE items ADD COLUMN publish_latitude FLOAT")
        )
    if "publish_longitude" not in names:
        db.session.execute(
            text("ALTER TABLE items ADD COLUMN publish_longitude FLOAT")
        )
    db.session.commit()


# ========== 启动时初始化 ==========
with app.app_context():
    init_db()
    _ensure_post_type_column()
    _ensure_location_columns()
    _ensure_user_profile_columns()
    _ensure_student_verify_status_column()
    _migrate_legacy_verified_to_status()
    _ensure_admin_user()
    _ensure_is_draft_column()
    _ensure_publish_geo_columns()
    
    # 注册管理员后台路由
    register_admin_routes()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=True)
