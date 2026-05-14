import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space, Breadcrumb, Button, message } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { removeAdminToken, getAdminUser } from '../utils/auth'
import { adminLogout } from '../utils/api'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据统计' },
  { key: '/items', icon: <AppstoreOutlined />, label: '信息管理' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/clues', icon: <LinkOutlined />, label: '线索管理' },
  { key: '/verifications', icon: <SafetyCertificateOutlined />, label: '学生认证' },
]

const breadcrumbMap = {
  '/': '数据统计',
  '/items': '信息管理',
  '/users': '用户管理',
  '/clues': '线索管理',
  '/verifications': '学生认证',
}

function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const adminUser = getAdminUser() || {}

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
    // 通知 App 更新状态
    window.dispatchEvent(new Event('storage'))
  }

  const userMenuItems = [
    {
      key: 'username',
      icon: <UserOutlined />,
      label: adminUser.username || '管理员',
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

  const currentLabel = breadcrumbMap[location.pathname] || ''

  return (
    <Layout className="admin-layout">
      <Sider
        width={220}
        collapsedWidth={64}
        collapsed={collapsed}
        className="admin-sider"
        theme="dark"
        trigger={null}
      >
        <div className="admin-logo">
          <span className="logo-icon">🏫</span>
          {!collapsed && <span>失物招领管理</span>}
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
          <div className="admin-header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <Breadcrumb
              items={[
                { title: '首页' },
                { title: currentLabel },
              ]}
            />
          </div>
          <div className="admin-header-right">
            <span style={{ color: '#8c8c8c', fontSize: 13 }}>
              校园失物招领后台系统
            </span>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <Space style={{ cursor: 'pointer', padding: '0 8px' }}>
                <Avatar size="small" style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                <span style={{ color: '#595959', fontSize: 13 }}>
                  {adminUser.username || '管理员'}
                </span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content">{children}</Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
