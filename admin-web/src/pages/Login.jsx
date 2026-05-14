import React, { useState } from 'react'
import { Form, Input, Button, Card } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { adminLogin } from '../utils/api'
import { setAdminToken, setAdminUser } from '../utils/auth'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'

function Login() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const res = await adminLogin(values)
      setAdminToken(res.token)
      setAdminUser({ username: res.username })
      message.success('登录成功')
      // 触发事件通知 App 更新状态
      window.dispatchEvent(new Event('storage'))
      navigate('/')
    } catch (e) {
      // 错误已在拦截器中处理
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card" bordered={false}>
        <h1>管理员登录</h1>
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入管理员账号' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="管理员账号"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, textAlign: 'center', color: '#999', fontSize: 12 }}>
          默认管理员账号: 000 | 密码: 0000
        </div>
      </Card>
    </div>
  )
}

export default Login
