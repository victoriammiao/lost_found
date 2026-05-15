# -*- coding: utf-8 -*-
"""
校园失物招领系统 - 单元测试
测试框架: unittest + Flask test client
"""

import os
import sys
import json
import unittest

# 添加backend目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db, User, Item, ItemClue, tokens, ADMIN_USERNAME


class TestBase(unittest.TestCase):
    """测试基类，提供通用的测试配置和辅助方法"""

    def setUp(self):
        # 使用内存数据库进行测试
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
        
        self.client = app.test_client()
        
        with app.app_context():
            db.create_all()
            # 初始化管理员用户（先检查是否已存在）
            from werkzeug.security import generate_password_hash
            existing_admin = User.query.filter_by(username=ADMIN_USERNAME).first()
            if not existing_admin:
                admin = User(
                    username=ADMIN_USERNAME,
                    password_hash=generate_password_hash("0000"),
                    student_verified=False,
                    student_verify_status="",
                    real_name="",
                    student_no=""
                )
                db.session.add(admin)
                db.session.commit()
        
        # 清空tokens
        tokens.clear()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()
        tokens.clear()

    def register_user(self, username, password):
        """辅助方法：注册用户"""
        return self.client.post(
            '/register',
            data=json.dumps({'username': username, 'password': password}),
            content_type='application/json'
        )

    def login_user(self, username, password):
        """辅助方法：用户登录，返回token"""
        response = self.client.post(
            '/login',
            data=json.dumps({'username': username, 'password': password}),
            content_type='application/json'
        )
        return response

    def admin_login(self, password="0000"):
        """辅助方法：管理员登录，返回token"""
        response = self.client.post(
            '/admin/login',
            data=json.dumps({'username': ADMIN_USERNAME, 'password': password}),
            content_type='application/json'
        )
        return response


class TestUserAuth(TestBase):
    """用户认证相关测试"""

    def test_register_success(self):
        """测试注册成功"""
        response = self.register_user('testuser', '123456')
        data = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['message'], '注册成功')

    def test_register_empty_username(self):
        """测试注册空用户名"""
        response = self.register_user('', '123456')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '账号和密码不能为空')

    def test_register_short_username(self):
        """测试注册过短用户名"""
        response = self.register_user('a', '123456')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '账号不能少于2位')

    def test_register_short_password(self):
        """测试注册过短密码"""
        response = self.register_user('testuser', '123')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '密码不能少于4位')

    def test_register_duplicate(self):
        """测试注册已存在的账号"""
        self.register_user('testuser', '123456')
        response = self.register_user('testuser', '123456')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '该账号已被注册')

    def test_register_admin_username(self):
        """测试注册管理员保留账号（管理员账号已存在时返回已被注册）"""
        response = self.register_user(ADMIN_USERNAME, '123456')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertIn(data['message'], ['该账号为系统保留账号', '该账号已被注册'])

    def test_login_success(self):
        """测试登录成功"""
        self.register_user('testuser', '123456')
        response = self.login_user('testuser', '123456')
        data = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['message'], '登录成功')
        self.assertIn('token', data)
        self.assertEqual(data['username'], 'testuser')

    def test_login_empty(self):
        """测试空账号密码登录"""
        response = self.login_user('', '')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '账号和密码不能为空')

    def test_login_invalid_user(self):
        """测试登录不存在的用户"""
        response = self.login_user('nonexistent', '123456')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '账号或密码错误')

    def test_login_wrong_password(self):
        """测试登录密码错误"""
        self.register_user('testuser', '123456')
        response = self.login_user('testuser', 'wrongpass')
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '账号或密码错误')

    def test_admin_login_success(self):
        """测试管理员登录成功"""
        response = self.admin_login()
        data = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['username'], ADMIN_USERNAME)

    def test_admin_login_wrong_password(self):
        """测试管理员密码错误"""
        response = self.admin_login(password='wrong')
        data = response.get_json()
        self.assertEqual(data['code'], 1)


class TestStudentVerification(TestBase):
    """学生认证相关测试"""

    def test_submit_verify_request(self):
        """测试提交学生认证申请"""
        self.register_user('student', '123456')
        login_resp = self.login_user('student', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.post(
            '/profile/verify',
            data=json.dumps({
                'realName': '张三',
                'studentNo': '2021123456'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['message'], '已提交申请，请等待管理员审核')

    def test_submit_verify_empty_name(self):
        """测试提交认证时姓名为空"""
        self.register_user('student', '123456')
        login_resp = self.login_user('student', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.post(
            '/profile/verify',
            data=json.dumps({
                'realName': '',
                'studentNo': '2021123456'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '请填写真实姓名（至少2字）')

    def test_submit_verify_short_student_no(self):
        """测试提交认证时学号过短"""
        self.register_user('student', '123456')
        login_resp = self.login_user('student', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.post(
            '/profile/verify',
            data=json.dumps({
                'realName': '张三',
                'studentNo': '123'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '请填写有效学号')

    def test_approve_student_verify(self):
        """测试管理员通过学生认证"""
        self.register_user('student', '123456')
        login_resp = self.login_user('student', '123456')
        token = login_resp.get_json()['token']
        
        self.client.post(
            '/profile/verify',
            data=json.dumps({'realName': '张三', 'studentNo': '2021123456'}),
            content_type='application/json',
            headers={'Authorization': token}
        )
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/student-verifications/approve',
            data=json.dumps({'username': 'student'}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['message'], '已通过')

    def test_reject_student_verify(self):
        """测试管理员拒绝学生认证"""
        self.register_user('student', '123456')
        login_resp = self.login_user('student', '123456')
        token = login_resp.get_json()['token']
        
        self.client.post(
            '/profile/verify',
            data=json.dumps({'realName': '张三', 'studentNo': '2021123456'}),
            content_type='application/json',
            headers={'Authorization': token}
        )
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/student-verifications/reject',
            data=json.dumps({'username': 'student'}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['message'], '已驳回')


class TestItemManagement(TestBase):
    """物品管理相关测试"""

    def test_publish_draft(self):
        """测试保存草稿"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.post(
            '/items',
            data=json.dumps({
                'title': '测试草稿',
                'description': '这是一个测试草稿',
                'saveAsDraft': True
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertTrue(data['data']['isDraft'])

    def test_publish_item_without_location(self):
        """测试发布物品时未选择地点"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.post(
            '/items',
            data=json.dumps({
                'title': '测试物品',
                'description': '测试描述',
                'contact': '13800138000'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '请选择校区地点')

    def test_publish_item_without_contact(self):
        """测试发布物品时未填写联系方式"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.post(
            '/items',
            data=json.dumps({
                'title': '测试物品',
                'description': '测试描述',
                'locationId': 'dorm_1'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '请填写联系方式（手机/微信号等，至少3位）')

    def test_get_items_list(self):
        """测试获取物品列表"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.get(
            '/items',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertIsInstance(data['data'], list)

    def test_get_my_items(self):
        """测试获取我的物品"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        response = self.client.get(
            '/items/mine',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_update_draft_item(self):
        """测试更新草稿物品"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        publish_resp = self.client.post(
            '/items',
            data=json.dumps({
                'title': '草稿',
                'description': '描述',
                'saveAsDraft': True
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        item_id = publish_resp.get_json()['data']['id']
        
        response = self.client.put(
            f'/items/{item_id}',
            data=json.dumps({
                'title': '更新后的标题',
                'description': '更新后的描述'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['data']['title'], '更新后的标题')

    def test_delete_my_item(self):
        """测试删除我的物品"""
        self.register_user('user', '123456')
        login_resp = self.login_user('user', '123456')
        token = login_resp.get_json()['token']
        
        publish_resp = self.client.post(
            '/items',
            data=json.dumps({
                'title': '草稿',
                'description': '描述',
                'saveAsDraft': True
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        item_id = publish_resp.get_json()['data']['id']
        
        response = self.client.delete(
            f'/items/{item_id}',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_delete_other_item(self):
        """测试删除他人物品（无权）"""
        self.register_user('user1', '123456')
        self.register_user('user2', '654321')
        
        login_resp1 = self.login_user('user1', '123456')
        token1 = login_resp1.get_json()['token']
        
        publish_resp = self.client.post(
            '/items',
            data=json.dumps({
                'title': '草稿',
                'description': '描述',
                'saveAsDraft': True
            }),
            content_type='application/json',
            headers={'Authorization': token1}
        )
        item_id = publish_resp.get_json()['data']['id']
        
        login_resp2 = self.login_user('user2', '654321')
        token2 = login_resp2.get_json()['token']
        
        response = self.client.delete(
            f'/items/{item_id}',
            headers={'Authorization': token2}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '无权删除')


class TestClueManagement(TestBase):
    """线索管理相关测试"""

    def test_submit_clue(self):
        """测试提交线索"""
        self.register_user('user1', '123456')  # 发布者
        self.register_user('user2', '654321')  # 线索提交者
        
        # 用户1登录并发布物品（草稿）
        login_resp1 = self.login_user('user1', '123456')
        token1 = login_resp1.get_json()['token']
        
        # 先发布草稿，然后直接修改状态为已审核
        with app.app_context():
            item = Item(
                title='丢失的手机',
                description='黑色iPhone',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user1',
                post_type='寻物',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='approved',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id
        
        # 用户2登录提交线索
        login_resp2 = self.login_user('user2', '654321')
        token2 = login_resp2.get_json()['token']
        
        response = self.client.post(
            f'/items/{item_id}/clues',
            data=json.dumps({
                'contact': '13900139000',
                'foundLocation': '图书馆',
                'description': '在图书馆看到一部黑色手机'
            }),
            content_type='application/json',
            headers={'Authorization': token2}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_submit_clue_to_own_item(self):
        """测试给自己的物品提交线索（禁止）"""
        self.register_user('user1', '123456')
        
        login_resp = self.login_user('user1', '123456')
        token = login_resp.get_json()['token']
        
        with app.app_context():
            item = Item(
                title='丢失的手机',
                description='黑色iPhone',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user1',
                post_type='寻物',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='approved',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id
        
        response = self.client.post(
            f'/items/{item_id}/clues',
            data=json.dumps({
                'contact': '13900139000',
                'description': '找到手机了'
            }),
            content_type='application/json',
            headers={'Authorization': token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 1)
        self.assertEqual(data['message'], '不能给自己的帖子提交线索')

    def test_admin_match_clue(self):
        """测试管理员采纳线索"""
        self.register_user('user1', '123456')
        self.register_user('user2', '654321')
        
        login_resp1 = self.login_user('user1', '123456')
        token1 = login_resp1.get_json()['token']
        
        with app.app_context():
            item = Item(
                title='丢失的手机',
                description='黑色iPhone',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user1',
                post_type='寻物',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='approved',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            
            clue = ItemClue(
                item_id=item.id,
                submitter='user2',
                contact='13900139000',
                description='找到了手机',
                status='pending',
                create_time='2024-01-01 11:00:00'
            )
            db.session.add(clue)
            db.session.commit()
            clue_id = clue.id
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/clues/match',
            data=json.dumps({'id': clue_id}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_admin_reject_clue(self):
        """测试管理员拒绝线索"""
        self.register_user('user1', '123456')
        self.register_user('user2', '654321')
        
        with app.app_context():
            item = Item(
                title='丢失的手机',
                description='黑色iPhone',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user1',
                post_type='寻物',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='approved',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            
            clue = ItemClue(
                item_id=item.id,
                submitter='user2',
                contact='13900139000',
                description='假线索',
                status='pending',
                create_time='2024-01-01 11:00:00'
            )
            db.session.add(clue)
            db.session.commit()
            clue_id = clue.id
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/clues/reject',
            data=json.dumps({'id': clue_id}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)


class TestAdminItemManagement(TestBase):
    """管理员物品管理测试"""

    def test_admin_approve_item(self):
        """测试管理员审核通过物品"""
        self.register_user('user', '123456')
        
        with app.app_context():
            item = Item(
                title='待审核物品',
                description='描述',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user',
                post_type='招领',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='pending',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/items/approve',
            data=json.dumps({'id': item_id}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_admin_reject_item(self):
        """测试管理员拒绝物品"""
        self.register_user('user', '123456')
        
        with app.app_context():
            item = Item(
                title='待审核物品',
                description='描述',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user',
                post_type='招领',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='pending',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/items/reject',
            data=json.dumps({'id': item_id}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_admin_delete_item(self):
        """测试管理员删除物品"""
        self.register_user('user', '123456')
        
        with app.app_context():
            item = Item(
                title='测试物品',
                description='描述',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user',
                post_type='招领',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='approved',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.post(
            '/admin/items/delete',
            data=json.dumps({'id': item_id}),
            content_type='application/json',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)


class TestAdminUserManagement(TestBase):
    """管理员用户管理测试"""

    def test_admin_list_users(self):
        """测试管理员获取用户列表"""
        self.register_user('user1', '123456')
        self.register_user('user2', '654321')
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.get(
            '/admin/users',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['data']['total'], 2)

    def test_admin_list_user_items(self):
        """测试管理员获取用户物品列表"""
        self.register_user('user', '123456')
        
        with app.app_context():
            item = Item(
                title='用户物品',
                description='描述',
                status='未认领',
                create_time='2024-01-01 10:00:00',
                publisher='user',
                post_type='招领',
                location_id='dorm_1',
                location_label='学生宿舍 · 东1栋',
                is_draft=False,
                review_status='approved',
                contact='13800138000'
            )
            db.session.add(item)
            db.session.commit()
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.get(
            '/admin/users/user/items',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertEqual(data['data']['total'], 1)


class TestAdminStats(TestBase):
    """管理员统计功能测试"""

    def test_admin_stats_overview(self):
        """测试管理员获取总览统计"""
        self.register_user('user', '123456')
        
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.get(
            '/admin/stats/overview',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)
        self.assertIn('totalItems', data['data'])
        self.assertIn('totalUsers', data['data'])

    def test_admin_stats_trend(self):
        """测试管理员获取发布趋势"""
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.get(
            '/admin/stats/trend',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)

    def test_admin_stats_distribution(self):
        """测试管理员获取分布统计"""
        admin_resp = self.admin_login()
        admin_token = admin_resp.get_json()['token']
        
        response = self.client.get(
            '/admin/stats/distribution',
            headers={'Authorization': admin_token}
        )
        data = response.get_json()
        self.assertEqual(data['code'], 0)


class TestHealthCheck(TestBase):
    """健康检查测试"""

    def test_health_check(self):
        """测试健康检查接口"""
        response = self.client.get('/')
        data = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['code'], 0)
        self.assertIn('running', data['message'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
