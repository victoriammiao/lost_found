import React, { useState } from 'react'
import { Form, Input, Button, Card } from 'antd'
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
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
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <SafetyCertificateOutlined style={{ fontSize: 44, color: '#1890ff' }} />
        </div>
        <h1>失物招领管理后台</h1>
        <p className="login-subtitle">Lost & Found Admin System</p>
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
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="管理员账号"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 42, fontSize: 15, fontWeight: 500 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div style={{
          marginTop: 20,
          textAlign: 'center',
          color: '#bfbfbf',
          fontSize: 12,
          paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
        }}>
          默认管理员账号: <strong style={{ color: '#8c8c8c' }}>000</strong> &nbsp;|&nbsp;
          密码: <strong style={{ color: '#8c8c8c' }}>0000</strong>
        </div>
      </Card>
    </div>
  )
}

export default Login
