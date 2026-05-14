import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, Input, Select, DatePicker,
  Form, message, Popconfirm, Drawer, Image, Empty, Descriptions, Divider, Tooltip
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
  CheckCircleOutlined, StopOutlined, AppstoreOutlined, FilterOutlined
} from '@ant-design/icons'
import { getItems, updateItem, reviewItem, batchReviewItems, batchDeleteItems } from '../utils/api'

const { RangePicker } = DatePicker

function ItemList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({})
  const [keywordInput, setKeywordInput] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [editVisible, setEditVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState(null)
  const [form] = Form.useForm()

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
      const res = await getItems(params)
      const payload = res?.data || {}
      setData(Array.isArray(payload.list) ? payload.list : [])
      setPagination((prev) => ({
        ...prev,
        total: typeof payload.total === 'number' ? payload.total : 0,
      }))
      setSelectedRowKeys([])
    } catch (e) {
      console.error('Failed to fetch items:', e)
      setData([])
      setPagination((prev) => ({ ...prev, total: 0 }))
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = (patch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      // 移除空值
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

  const handleView = (record) => {
    setCurrentItem(record)
    setDetailVisible(true)
  }

  const handleEdit = (record) => {
    setCurrentItem(record)
    form.setFieldsValue({
      title: record.title,
      description: record.description,
      status: record.status,
      contact: record.contact,
    })
    setEditVisible(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields()
      await updateItem(currentItem.id, values)
      message.success('更新成功')
      setEditVisible(false)
      fetchData()
    } catch (e) {
      // 表单验证失败或请求失败
    }
  }

  const handleReview = async (record, action) => {
    try {
      await reviewItem(record.id, action)
      message.success(action === 'approve' ? '审核通过' : '审核拒绝')
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const handleBatchReview = async (action) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要审核的物品')
      return
    }
    try {
      await batchReviewItems(selectedRowKeys, action)
      message.success(`已更新 ${selectedRowKeys.length} 条记录`)
      setSelectedRowKeys([])
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const handleBatchDelete = async (idsOverride) => {
    const ids = Array.isArray(idsOverride) ? idsOverride : selectedRowKeys
    if (ids.length === 0) {
      message.warning('请选择要删除的物品')
      return
    }
    try {
      await batchDeleteItems(ids)
      message.success(`已删除 ${ids.length} 条记录`)
      setSelectedRowKeys([])
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  // ===== 标签渲染 =====
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

  const getStatusTag = (status) => {
    if (status === '已认领') return <Tag className="tag-claimed">已认领</Tag>
    return <Tag className="tag-unclaimed">未认领</Tag>
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      width: 80,
      render: (url) =>
        url ? (
          <Image
            src={url}
            width={56}
            height={56}
            style={{ objectFit: 'cover', borderRadius: 6 }}
            preview={{ mask: <EyeOutlined /> }}
          />
        ) : (
          <div className="empty-image">无图</div>
        ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Tooltip>
      ),
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
      render: (status) => getStatusTag(status),
    },
    {
      title: '审核',
      dataIndex: 'reviewStatus',
      width: 90,
      render: (status) => getReviewTag(status),
    },
    {
      title: '发布者',
      dataIndex: 'publisher',
      width: 110,
    },
    {
      title: '发布时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          {record.reviewStatus === 'pending' && (
            <>
              <Popconfirm
                title="确定通过审核？"
                onConfirm={() => handleReview(record, 'approve')}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定拒绝审核？"
                onConfirm={() => handleReview(record, 'reject')}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此物品？"
            description="此操作不可恢复"
            onConfirm={() => handleBatchDelete([record.id])}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  }

  // 兼容后端字段 claimr / claimer 笔误
  const getClaimer = (item) => item?.claimer || item?.claimr || ''

  return (
    <div>
      <div className="page-header">
        <Space align="center">
          <AppstoreOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <h2 style={{ margin: 0 }}>信息管理</h2>
          <span style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>
            共 {pagination.total} 条
          </span>
        </Space>
      </div>

      <div className="filter-bar">
        <Space wrap size={[12, 12]}>
          <span className="filter-label">
            <FilterOutlined /> 筛选：
          </span>
          <Input
            placeholder="搜索标题/描述"
            style={{ width: 220 }}
            allowClear
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          />
          <Select
            placeholder="物品类型"
            style={{ width: 130 }}
            allowClear
            value={filters.postType}
            onChange={(value) => applyFilter({ postType: value })}
            options={[
              { label: '寻物', value: '寻物' },
              { label: '招领', value: '招领' },
            ]}
          />
          <Select
            placeholder="物品状态"
            style={{ width: 130 }}
            allowClear
            value={filters.status}
            onChange={(value) => applyFilter({ status: value })}
            options={[
              { label: '未认领', value: '未认领' },
              { label: '已认领', value: '已认领' },
            ]}
          />
          <Select
            placeholder="审核状态"
            style={{ width: 130 }}
            allowClear
            value={filters.reviewStatus}
            onChange={(value) => applyFilter({ reviewStatus: value })}
            options={[
              { label: '待审核', value: 'pending' },
              { label: '已通过', value: 'approved' },
              { label: '已拒绝', value: 'rejected' },
            ]}
          />
          <RangePicker
            onChange={(dates) => {
              applyFilter({
                startDate: dates?.[0]?.format('YYYY-MM-DD') || '',
                endDate: dates?.[1]?.format('YYYY-MM-DD') || '',
              })
            }}
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
        <div className="table-toolbar">
          <Space>
            <Popconfirm
              title={`确定批量通过选中的 ${selectedRowKeys.length} 条物品？`}
              onConfirm={() => handleBatchReview('approve')}
              disabled={selectedRowKeys.length === 0}
              okText="确定"
              cancelText="取消"
            >
              <Button type="primary" icon={<CheckCircleOutlined />} disabled={selectedRowKeys.length === 0}>
                批量通过
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`确定批量拒绝选中的 ${selectedRowKeys.length} 条物品？`}
              onConfirm={() => handleBatchReview('reject')}
              disabled={selectedRowKeys.length === 0}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<StopOutlined />} disabled={selectedRowKeys.length === 0}>
                批量拒绝
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`确定删除选中的 ${selectedRowKeys.length} 条物品？`}
              description="此操作不可恢复"
              onConfirm={() => handleBatchDelete()}
              disabled={selectedRowKeys.length === 0}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>
                批量删除
              </Button>
            </Popconfirm>
            <span style={{ color: '#999', marginLeft: 8 }}>
              已选择 {selectedRowKeys.length} 项
            </span>
          </Space>
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={fetchData} />
          </Tooltip>
        </div>

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
          rowSelection={rowSelection}
          scroll={{ x: 1300 }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无物品数据" />,
          }}
        />
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title={<><EyeOutlined /> 物品详情</>}
        placement="right"
        width={560}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
      >
        {currentItem && (
          <div>
            {currentItem.imageUrl ? (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Image
                  src={currentItem.imageUrl}
                  style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8 }}
                />
              </div>
            ) : (
              <div className="empty-image" style={{
                width: '100%', height: 160, marginBottom: 16,
              }}>
                暂无图片
              </div>
            )}

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="物品ID">{currentItem.id}</Descriptions.Item>
              <Descriptions.Item label="标题">{currentItem.title}</Descriptions.Item>
              <Descriptions.Item label="类型">{getTypeTag(currentItem.postType)}</Descriptions.Item>
              <Descriptions.Item label="物品状态">{getStatusTag(currentItem.status)}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{getReviewTag(currentItem.reviewStatus)}</Descriptions.Item>
              <Descriptions.Item label="所在地点">
                {currentItem.locationLabel || <span style={{ color: '#bbb' }}>未指定</span>}
              </Descriptions.Item>
              <Descriptions.Item label="发布者">{currentItem.publisher}</Descriptions.Item>
              <Descriptions.Item label="发布时间">{currentItem.createTime}</Descriptions.Item>
              <Descriptions.Item label="认领者">
                {getClaimer(currentItem) || <span style={{ color: '#bbb' }}>无</span>}
              </Descriptions.Item>
              <Descriptions.Item label="联系方式">
                {currentItem.contact || <span style={{ color: '#bbb' }}>无</span>}
              </Descriptions.Item>
              <Descriptions.Item label="线索数">
                <Tag color="blue">{currentItem.clueCount || 0}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <div className="detail-section-title">物品描述</div>
            <div className="detail-text">
              {currentItem.description || '（无描述）'}
            </div>
          </div>
        )}
      </Drawer>

      {/* 编辑抽屉 */}
      <Drawer
        title={<><EditOutlined /> 编辑物品</>}
        placement="right"
        width={520}
        onClose={() => setEditVisible(false)}
        open={editVisible}
        extra={
          <Space>
            <Button onClick={() => setEditVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleEditSubmit}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入物品标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="物品描述" />
          </Form.Item>
          <Form.Item name="status" label="物品状态">
            <Select
              options={[
                { label: '未认领', value: '未认领' },
                { label: '已认领', value: '已认领' },
              ]}
            />
          </Form.Item>
          <Form.Item name="contact" label="联系方式">
            <Input placeholder="联系方式" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default ItemList
