import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, Input, Select, Drawer, Descriptions, Tabs, message, Popconfirm
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  StopOutlined, PlayCircleOutlined
} from '@ant-design/icons'
import { getUsers, getUserItems } from '../utils/api'

function UserList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({})
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userItems, setUserItems] = useState([])
  const [userItemsLoading, setUserItemsLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [pagination.current, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      }
      const res = await getUsers(params)
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, total: res.data.total }))
    } catch (e) {
      console.error('Failed to fetch users:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }))
    fetchData()
  }

  const handleReset = () => {
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
    try {
      const res = await getUserItems(record.username)
      setUserItems(res.data.list)
    } catch (e) {
      console.error('Failed to fetch user items:', e)
    } finally {
      setUserItemsLoading(false)
    }
  }

  const getVerifyTag = (status) => {
    const map = {
      approved: { color: 'green', text: '已认证' },
      pending: { color: 'orange', text: '待审核' },
      rejected: { color: 'red', text: '已拒绝' },
      none: { color: 'default', text: '未认证' },
      '': { color: 'default', text: '未认证' },
    }
    const tag = map[status] || map.none
    return <Tag color={tag.color}>{tag.text}</Tag>
  }

  const userItemColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'postType',
      width: 80,
      render: (type) => type === '寻物' ? <Tag color="blue">寻物</Tag> : <Tag color="pink">招领</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status) => <Tag color={status === '已认领' ? 'green' : 'blue'}>{status}</Tag>,
    },
    {
      title: '审核',
      dataIndex: 'reviewStatus',
      width: 80,
      render: (status) => {
        const map = {
          pending: { color: 'orange', text: '待审核' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已拒绝' },
        }
        const tag = map[status] || map.pending
        return <Tag color={tag.color}>{tag.text}</Tag>
      },
    },
    {
      title: '发布时间',
      dataIndex: 'createTime',
      width: 160,
    },
  ]

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 120,
    },
    {
      title: '学生认证',
      dataIndex: 'studentVerifyStatus',
      width: 100,
      render: (status) => getVerifyTag(status),
    },
    {
      title: '真实姓名',
      dataIndex: 'realName',
      width: 100,
      render: (name) => name || '-',
    },
    {
      title: '学号',
      dataIndex: 'studentNoMasked',
      width: 120,
    },
    {
      title: '发布数',
      dataIndex: 'itemCount',
      width: 80,
      render: (count, record) => (
        <span>
          总计 {count} | 待审核 {record.pendingCount || 0}
        </span>
      ),
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
        </Space>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户名">{currentUser?.username}</Descriptions.Item>
          <Descriptions.Item label="学生认证">{getVerifyTag(currentUser?.studentVerifyStatus)}</Descriptions.Item>
          <Descriptions.Item label="真实姓名">{currentUser?.realName || '-'}</Descriptions.Item>
          <Descriptions.Item label="学号">{currentUser?.studentNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="发布物品数">{currentUser?.itemCount || 0}</Descriptions.Item>
          <Descriptions.Item label="待审核物品数">{currentUser?.pendingCount || 0}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'items',
      label: `发布记录 (${userItems.length})`,
      children: (
        <Table
          columns={userItemColumns}
          dataSource={userItems}
          rowKey="id"
          loading={userItemsLoading}
          size="small"
          pagination={{ pageSize: 5 }}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>用户管理</h2>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索用户名"
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onPressEnter={handleSearch}
          suffix={<SearchOutlined />}
        />
        <Select
          placeholder="认证状态"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => setFilters({ ...filters, verifyStatus: value })}
          options={[
            { label: '已认证', value: 'approved' },
            { label: '待审核', value: 'pending' },
            { label: '已拒绝', value: 'rejected' },
            { label: '未认证', value: 'none' },
          ]}
        />
        <Button type="primary" onClick={handleSearch}>
          搜索
        </Button>
        <Button onClick={handleReset}>
          重置
        </Button>
      </div>

      <div className="table-card">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </div>

      <Drawer
        title="用户详情"
        placement="right"
        width={600}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
      >
        {currentUser && <Tabs items={tabItems} />}
      </Drawer>
    </div>
  )
}

export default UserList
