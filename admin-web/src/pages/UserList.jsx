import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, Input, Select, Drawer, Descriptions,
  Tabs, Empty, Avatar, Badge, Tooltip
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  UserOutlined, SafetyCertificateOutlined, FilterOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  MinusCircleOutlined
} from '@ant-design/icons'
import { getUsers, getUserItems } from '../utils/api'

function UserList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({})
  const [keywordInput, setKeywordInput] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userItems, setUserItems] = useState([])
  const [userItemsLoading, setUserItemsLoading] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      }
      const res = await getUsers(params)
      const payload = res?.data || {}
      setData(Array.isArray(payload.list) ? payload.list : [])
      setPagination((prev) => ({
        ...prev,
        total: typeof payload.total === 'number' ? payload.total : 0,
      }))
    } catch (e) {
      console.error('Failed to fetch users:', e)
      setData([])
      setPagination((prev) => ({ ...prev, total: 0 }))
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = (patch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      Object.keys(next).forEach((k) => {
        if (next[k] === undefined || next[k] === null || next[k] === '') {
          delete next[k]
        }
      })
      return next
    })
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleSearch = () => {
    applyFilter({ keyword: keywordInput.trim() })
  }

  const handleReset = () => {
    setKeywordInput('')
    setFilters({})
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
  }

  const handleView = async (record) => {
    setCurrentUser(record)
    setDetailVisible(true)

    // 加载用户发布的物品
    setUserItemsLoading(true)
    setUserItems([])
    try {
      const res = await getUserItems(record.username, { page: 1, pageSize: 50 })
      const payload = res?.data || {}
      setUserItems(Array.isArray(payload.list) ? payload.list : [])
    } catch (e) {
      console.error('Failed to fetch user items:', e)
      setUserItems([])
    } finally {
      setUserItemsLoading(false)
    }
  }

  const getVerifyTag = (status) => {
    const map = {
      approved: {
        className: 'tag-approved',
        text: '已认证',
        icon: <CheckCircleOutlined />,
      },
      pending: {
        className: 'tag-pending',
        text: '待审核',
        icon: <ClockCircleOutlined />,
      },
      rejected: {
        className: 'tag-rejected',
        text: '已拒绝',
        icon: <CloseCircleOutlined />,
      },
      none: {
        className: 'tag-unverified',
        text: '未认证',
        icon: <MinusCircleOutlined />,
      },
      '': {
        className: 'tag-unverified',
        text: '未认证',
        icon: <MinusCircleOutlined />,
      },
    }
    const tag = map[status] || map.none
    return (
      <Tag className={tag.className} icon={tag.icon}>
        {tag.text}
      </Tag>
    )
  }

  const getReviewTag = (status) => {
    const map = {
      pending: { className: 'tag-pending', text: '待审核' },
      approved: { className: 'tag-approved', text: '已通过' },
      rejected: { className: 'tag-rejected', text: '已拒绝' },
    }
    const tag = map[status] || map.pending
    return <Tag className={tag.className}>{tag.text}</Tag>
  }

  const getTypeTag = (type) => {
    if (type === '寻物') return <Tag className="tag-lost">寻物</Tag>
    if (type === '招领') return <Tag className="tag-found">招领</Tag>
    return <Tag>{type || '-'}</Tag>
  }

  const getItemStatusTag = (status) => {
    if (status === '已认领') return <Tag className="tag-claimed">已认领</Tag>
    return <Tag className="tag-unclaimed">未认领</Tag>
  }

  const userItemColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (text) => <Tooltip title={text}>{text}</Tooltip>,
    },
    {
      title: '类型',
      dataIndex: 'postType',
      width: 80,
      render: (type) => getTypeTag(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status) => getItemStatusTag(status),
    },
    {
      title: '审核',
      dataIndex: 'reviewStatus',
      width: 90,
      render: (status) => getReviewTag(status),
    },
    {
      title: '发布时间',
      dataIndex: 'createTime',
      width: 160,
    },
  ]

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '用户',
      dataIndex: 'username',
      width: 180,
      render: (username) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
          <span style={{ fontWeight: 500 }}>{username}</span>
        </Space>
      ),
    },
    {
      title: '学生认证',
      dataIndex: 'studentVerifyStatus',
      width: 120,
      render: (status) => getVerifyTag(status),
    },
    {
      title: '真实姓名',
      dataIndex: 'realName',
      width: 100,
      render: (name) => name || <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '学号',
      dataIndex: 'studentNoMasked',
      width: 130,
      render: (no) => no || <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '发布数',
      dataIndex: 'itemCount',
      width: 160,
      render: (count, record) => (
        <Space size={4}>
          <Tooltip title="发布总数">
            <Tag color="blue">总 {count || 0}</Tag>
          </Tooltip>
          {(record.pendingCount || 0) > 0 && (
            <Tooltip title="待审核数">
              <Tag color="orange">待审 {record.pendingCount}</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      width: 110,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
          查看详情
        </Button>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: currentUser && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 16px',
            background: '#fafbfc',
            borderRadius: 8,
            marginBottom: 16,
          }}>
            <Avatar size={56} style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{currentUser.username}</div>
              <div style={{ marginTop: 4 }}>
                {getVerifyTag(currentUser.studentVerifyStatus)}
              </div>
            </div>
          </div>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户ID">{currentUser.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">{currentUser.username}</Descriptions.Item>
            <Descriptions.Item label="认证状态">
              {getVerifyTag(currentUser.studentVerifyStatus)}
            </Descriptions.Item>
            <Descriptions.Item label="真实姓名">
              {currentUser.realName || <span style={{ color: '#bbb' }}>未填写</span>}
            </Descriptions.Item>
            <Descriptions.Item label="学号">
              {currentUser.studentNo || <span style={{ color: '#bbb' }}>未填写</span>}
            </Descriptions.Item>
            <Descriptions.Item label="发布物品数">
              <Tag color="blue">{currentUser.itemCount || 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="待审核物品数">
              {(currentUser.pendingCount || 0) > 0
                ? <Tag color="orange">{currentUser.pendingCount}</Tag>
                : <Tag>0</Tag>
              }
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'items',
      label: (
        <span>
          发布记录 <Badge count={userItems.length} showZero style={{ backgroundColor: '#1890ff' }} />
        </span>
      ),
      children: (
        <Table
          columns={userItemColumns}
          dataSource={userItems}
          rowKey="id"
          loading={userItemsLoading}
          size="small"
          pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该用户暂无发布记录" />,
          }}
          scroll={{ x: 700 }}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Space align="center">
          <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <h2 style={{ margin: 0 }}>用户管理</h2>
          <span style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>
            共 {pagination.total} 个用户
          </span>
        </Space>
      </div>

      <div className="filter-bar">
        <Space wrap size={[12, 12]}>
          <span className="filter-label">
            <FilterOutlined /> 筛选：
          </span>
          <Input
            placeholder="搜索用户名"
            style={{ width: 220 }}
            allowClear
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          />
          <Select
            placeholder="认证状态"
            style={{ width: 140 }}
            allowClear
            value={filters.verifyStatus}
            onChange={(value) => applyFilter({ verifyStatus: value })}
            options={[
              { label: '已认证', value: 'approved' },
              { label: '待审核', value: 'pending' },
              { label: '已拒绝', value: 'rejected' },
              { label: '未认证', value: 'none' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <div className="table-card">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50'],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无用户数据" />,
          }}
        />
      </div>

      <Drawer
        title={<><UserOutlined /> 用户详情</>}
        placement="right"
        width={640}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        destroyOnClose
      >
        {currentUser && <Tabs items={tabItems} />}
      </Drawer>
    </div>
  )
}

export default UserList
