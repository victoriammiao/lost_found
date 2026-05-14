import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { removeAdminToken } from '../utils/auth'
import { message } from 'antd'
import { adminLogout } from '../utils/api'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据统计' },
  { key: '/items', icon: <AppstoreOutlined />, label: '信息管理' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/clues', icon: <LinkOutlined />, label: '线索管理' },
  { key: '/verifications', icon: <CheckCircleOutlined />, label: '学生认证' },
]

function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleMenuClick = (e) => {
    navigate(e.key)
  }

  const handleLogout = async () => {
    try {
      await adminLogout()
    } catch (e) {
      // 忽略错误
    }
    removeAdminToken()
    message.success('已退出登录')
    navigate('/login')
  }

  const userMenu = (
    <Menu
      items={[
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          onClick: handleLogout,
        },
      ]}
    />
  )

  return (
    <Layout className="admin-layout">
      <Sider width={220} className="admin-sider" theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.1)',
            margin: '8px',
            borderRadius: '8px',
          }}
        >
          🏫 失物招领管理后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div style={{ fontSize: 14, color: '#666' }}>校园失物招领系统</div>
          <Dropdown overlay={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
                A
              </Avatar>
              <span>管理员</span>
            </Space>
          </Dropdown>
        </Header>
        <Content className="admin-content">{children}</Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
