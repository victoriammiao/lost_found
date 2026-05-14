import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, Select, Drawer, Descriptions, message, Popconfirm, Image
} from 'antd'
import {
  EyeOutlined, CheckOutlined, CloseOutlined
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
  }, [pagination.current, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      }
      const res = await getAllClues(params)
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, total: res.data.total }))
    } catch (e) {
      console.error('Failed to fetch clues:', e)
    } finally {
      setLoading(false)
    }
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
      pending: { color: 'orange', text: '待处理' },
      matched: { color: 'green', text: '已采纳' },
      rejected: { color: 'red', text: '已拒绝' },
    }
    const tag = map[status] || map.pending
    return <Tag color={tag.color}>{tag.text}</Tag>
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '关联物品',
      dataIndex: 'itemTitle',
      ellipsis: true,
      render: (title, record) => (
        <span>
          {title}
          {record.itemPostType === '寻物' ? <Tag color="blue" style={{ marginLeft: 4 }}>寻物</Tag> : <Tag color="pink" style={{ marginLeft: 4 }}>招领</Tag>}
        </span>
      ),
    },
    {
      title: '提交人',
      dataIndex: 'submitter',
      width: 100,
    },
    {
      title: '发现地点',
      dataIndex: 'foundLocation',
      ellipsis: true,
    },
    {
      title: '发现时间',
      dataIndex: 'foundTime',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '提交时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleMatch(record)}>
                采纳
              </Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record)}>
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>线索管理</h2>
      </div>

      <div className="filter-bar">
        <Select
          placeholder="线索状态"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => setFilters({ status: value })}
          options={[
            { label: '待处理', value: 'pending' },
            { label: '已采纳', value: 'matched' },
            { label: '已拒绝', value: 'rejected' },
          ]}
        />
      </div>

      <div className="table-card">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </div>

      <Drawer
        title="线索详情"
        placement="right"
        width={500}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        extra={
          currentClue?.status === 'pending' && (
            <Space>
              <Popconfirm
                title="确定采纳此线索？"
                onConfirm={() => handleMatch(currentClue)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="primary" icon={<CheckOutlined />}>
                  采纳
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定拒绝此线索？"
                onConfirm={() => handleReject(currentClue)}
                okText="确定"
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
              <Descriptions.Item label="线索状态">
                {getStatusTag(currentClue.status)}
              </Descriptions.Item>
              <Descriptions.Item label="关联物品">
                {currentClue.itemTitle} ({currentClue.itemPostType})
              </Descriptions.Item>
              <Descriptions.Item label="物品发布者">
                {currentClue.itemPublisher}
              </Descriptions.Item>
              <Descriptions.Item label="发布者联系方式">
                {currentClue.posterContact || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="线索提交人">
                {currentClue.submitter}
              </Descriptions.Item>
              <Descriptions.Item label="提交人联系方式">
                {currentClue.contact}
              </Descriptions.Item>
              <Descriptions.Item label="发现地点">
                {currentClue.foundLocation || '未填写'}
              </Descriptions.Item>
              <Descriptions.Item label="发现时间">
                {currentClue.foundTime || '未填写'}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {currentClue.createTime}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <h4>线索描述</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{currentClue.description || '无'}</p>
            </div>

            {currentClue.imageUrl && (
              <div style={{ marginTop: 16 }}>
                <h4>线索图片</h4>
                <Image src={currentClue.imageUrl} style={{ maxWidth: '100%' }} />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default ClueList
