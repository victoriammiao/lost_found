import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, Select, Drawer, Descriptions,
  message, Popconfirm, Image, Empty, Tooltip
} from 'antd'
import {
  EyeOutlined, CheckOutlined, CloseOutlined,
  ReloadOutlined, FilterOutlined, LinkOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import { getAllClues, matchClue, rejectClue } from '../utils/api'

function ClueList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({})
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentClue, setCurrentClue] = useState(null)

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
      const res = await getAllClues(params)
      const payload = res?.data || {}
      setData(Array.isArray(payload.list) ? payload.list : [])
      setPagination((prev) => ({
        ...prev,
        total: typeof payload.total === 'number' ? payload.total : 0,
      }))
    } catch (e) {
      console.error('Failed to fetch clues:', e)
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

  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
  }

  const handleView = (record) => {
    setCurrentClue(record)
    setDetailVisible(true)
  }

  const handleMatch = async (record) => {
    try {
      await matchClue(record.id)
      message.success('已采纳该线索')
      setDetailVisible(false)
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const handleReject = async (record) => {
    try {
      await rejectClue(record.id)
      message.success('已拒绝该线索')
      setDetailVisible(false)
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const getStatusTag = (status) => {
    const map = {
      pending: {
        className: 'tag-pending',
        text: '待处理',
        icon: <ClockCircleOutlined />,
      },
      matched: {
        className: 'tag-matched',
        text: '已采纳',
        icon: <CheckCircleOutlined />,
      },
      rejected: {
        className: 'tag-rejected',
        text: '已拒绝',
        icon: <CloseCircleOutlined />,
      },
    }
    const tag = map[status] || map.pending
    return (
      <Tag className={tag.className} icon={tag.icon}>
        {tag.text}
      </Tag>
    )
  }

  const getTypeTag = (type) => {
    if (type === '寻物') return <Tag className="tag-lost">寻物</Tag>
    if (type === '招领') return <Tag className="tag-found">招领</Tag>
    return <Tag>{type || '-'}</Tag>
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '关联物品',
      dataIndex: 'itemTitle',
      ellipsis: true,
      render: (title, record) => (
        <Space size={4}>
          <Tooltip title={title}>
            <span style={{ fontWeight: 500 }}>{title}</span>
          </Tooltip>
          {getTypeTag(record.itemPostType)}
        </Space>
      ),
    },
    {
      title: '提交人',
      dataIndex: 'submitter',
      width: 110,
    },
    {
      title: '发现地点',
      dataIndex: 'foundLocation',
      ellipsis: true,
      render: (v) => v || <span style={{ color: '#bbb' }}>未填写</span>,
    },
    {
      title: '发现时间',
      dataIndex: 'foundTime',
      width: 140,
      render: (v) => v || <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status) => getStatusTag(status),
    },
    {
      title: '提交时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Popconfirm
                title="确定采纳该线索？"
                description="采纳后将关闭本帖其他待处理线索"
                onConfirm={() => handleMatch(record)}
                okText="确定采纳"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}>
                  采纳
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定拒绝该线索？"
                description="拒绝后该线索状态将变为已拒绝"
                onConfirm={() => handleReject(record)}
                okText="确定拒绝"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Space align="center">
          <LinkOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <h2 style={{ margin: 0 }}>线索管理</h2>
          <span style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>
            共 {pagination.total} 条线索
          </span>
        </Space>
      </div>

      <div className="filter-bar">
        <Space wrap size={[12, 12]}>
          <span className="filter-label">
            <FilterOutlined /> 筛选：
          </span>
          <Select
            placeholder="线索状态"
            style={{ width: 140 }}
            allowClear
            value={filters.status}
            onChange={(value) => applyFilter({ status: value })}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '已采纳', value: 'matched' },
              { label: '已拒绝', value: 'rejected' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
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
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无线索数据" />,
          }}
        />
      </div>

      <Drawer
        title={<><EyeOutlined /> 线索详情</>}
        placement="right"
        width={560}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        extra={
          currentClue?.status === 'pending' && (
            <Space>
              <Popconfirm
                title="确定采纳此线索？"
                description="采纳后将关闭本帖其他待处理线索"
                onConfirm={() => handleMatch(currentClue)}
                okText="确定采纳"
                cancelText="取消"
              >
                <Button type="primary" icon={<CheckOutlined />}>
                  采纳
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定拒绝此线索？"
                onConfirm={() => handleReject(currentClue)}
                okText="确定拒绝"
                cancelText="取消"
              >
                <Button danger icon={<CloseOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {currentClue && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="线索ID">{currentClue.id}</Descriptions.Item>
              <Descriptions.Item label="线索状态">
                {getStatusTag(currentClue.status)}
              </Descriptions.Item>
              <Descriptions.Item label="关联物品">
                <Space>
                  {currentClue.itemTitle}
                  {getTypeTag(currentClue.itemPostType)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="物品发布者">
                {currentClue.itemPublisher}
              </Descriptions.Item>
              <Descriptions.Item label="发布者联系方式">
                {currentClue.posterContact || <span style={{ color: '#bbb' }}>无</span>}
              </Descriptions.Item>
              <Descriptions.Item label="线索提交人">
                {currentClue.submitter}
              </Descriptions.Item>
              <Descriptions.Item label="提交人联系方式">
                {currentClue.contact || <span style={{ color: '#bbb' }}>无</span>}
              </Descriptions.Item>
              <Descriptions.Item label="发现地点">
                {currentClue.foundLocation || <span style={{ color: '#bbb' }}>未填写</span>}
              </Descriptions.Item>
              <Descriptions.Item label="发现时间">
                {currentClue.foundTime || <span style={{ color: '#bbb' }}>未填写</span>}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {currentClue.createTime}
              </Descriptions.Item>
            </Descriptions>

            <div className="detail-section-title">线索描述</div>
            <div className="detail-text">
              {currentClue.description || '（无描述）'}
            </div>

            {currentClue.imageUrl && (
              <>
                <div className="detail-section-title">线索图片</div>
                <Image
                  src={currentClue.imageUrl}
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                />
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default ClueList
