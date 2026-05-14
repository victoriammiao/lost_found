import React, { useState, useEffect } from 'react'
import {
  Table, Card, Tag, Button, Space, Input, Select, DatePicker,
  Modal, Form, message, Popconfirm, Drawer, Image
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
  CheckCircleOutlined, StopOutlined
} from '@ant-design/icons'
import { getItems, updateItem, reviewItem, batchReviewItems, batchDeleteItems } from '../utils/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

function ItemList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({})
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [editVisible, setEditVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState(null)
  const [form] = Form.useForm()

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
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const res = await getItems(params)
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, total: res.data.total }))
    } catch (e) {
      console.error('Failed to fetch items:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (values) => {
    setFilters(values)
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleReset = () => {
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

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的物品')
      return
    }
    try {
      await batchDeleteItems(selectedRowKeys)
      message.success(`已删除 ${selectedRowKeys.length} 条记录`)
      setSelectedRowKeys([])
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const getReviewTag = (status) => {
    const map = {
      pending: { color: 'orange', text: '待审核', className: 'tag-pending' },
      approved: { color: 'green', text: '已通过', className: 'tag-approved' },
      rejected: { color: 'red', text: '已拒绝', className: 'tag-rejected' },
    }
    const tag = map[status] || map.pending
    return <Tag className={tag.className}>{tag.text}</Tag>
  }

  const getTypeTag = (type) => {
    const map = {
      '寻物': { color: 'blue', text: '寻物', className: 'tag-lost' },
      '招领': { color: 'pink', text: '招领', className: 'tag-found' },
    }
    const tag = map[type] || map['招领']
    return <Tag className={tag.className}>{tag.text}</Tag>
  }

  const getStatusTag = (status) => {
    const map = {
      '未认领': { color: 'blue', text: '未认领', className: 'tag-unclaimed' },
      '已认领': { color: 'green', text: '已认领', className: 'tag-claimed' },
    }
    const tag = map[status] || map['未认领']
    return <Tag className={tag.className}>{tag.text}</Tag>
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      width: 80,
      render: (url) =>
        url ? (
          <Image src={url} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div className="empty-image">
            <span>无图</span>
          </div>
        ),
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
      render: (type) => getTypeTag(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status) => getStatusTag(status),
    },
    {
      title: '审核',
      dataIndex: 'reviewStatus',
      width: 80,
      render: (status) => getReviewTag(status),
    },
    {
      title: '发布者',
      dataIndex: 'publisher',
      width: 100,
    },
    {
      title: '发布时间',
      dataIndex: 'createTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          {record.reviewStatus === 'pending' && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleReview(record, 'approve')}>
                通过
              </Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleReview(record, 'reject')}>
                拒绝
              </Button>
            </>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此物品？"
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

  return (
    <div>
      <div className="page-header">
        <h2>信息管理</h2>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索标题/描述"
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          suffix={<SearchOutlined />}
        />
        <Select
          placeholder="物品类型"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => setFilters({ ...filters, postType: value })}
          options={[
            { label: '寻物', value: '寻物' },
            { label: '招领', value: '招领' },
          ]}
        />
        <Select
          placeholder="物品状态"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => setFilters({ ...filters, status: value })}
          options={[
            { label: '未认领', value: '未认领' },
            { label: '已认领', value: '已认领' },
          ]}
        />
        <Select
          placeholder="审核状态"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => setFilters({ ...filters, reviewStatus: value })}
          options={[
            { label: '待审核', value: 'pending' },
            { label: '已通过', value: 'approved' },
            { label: '已拒绝', value: 'rejected' },
          ]}
        />
        <RangePicker
          onChange={(dates) => {
            setFilters({
              ...filters,
              startDate: dates?.[0]?.format('YYYY-MM-DD') || '',
              endDate: dates?.[1]?.format('YYYY-MM-DD') || '',
            })
          }}
        />
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          重置
        </Button>
      </div>

      <div className="table-card">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleBatchReview('approve')}
              disabled={selectedRowKeys.length === 0}
            >
              批量通过
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={() => handleBatchReview('reject')}
              disabled={selectedRowKeys.length === 0}
            >
              批量拒绝
            </Button>
            <Popconfirm
              title={`确定删除选中的 ${selectedRowKeys.length} 条物品？`}
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          rowSelection={rowSelection}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title="物品详情"
        placement="right"
        width={500}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
      >
        {currentItem && (
          <div>
            {currentItem.imageUrl && (
              <Image src={currentItem.imageUrl} style={{ width: '100%', marginBottom: 16 }} />
            )}
            <p><strong>标题：</strong>{currentItem.title}</p>
            <p><strong>描述：</strong>{currentItem.description}</p>
            <p><strong>类型：</strong>{getTypeTag(currentItem.postType)}</p>
            <p><strong>状态：</strong>{getStatusTag(currentItem.status)}</p>
            <p><strong>审核：</strong>{getReviewTag(currentItem.reviewStatus)}</p>
            <p><strong>地点：</strong>{currentItem.locationLabel || '未指定'}</p>
            <p><strong>发布者：</strong>{currentItem.publisher}</p>
            <p><strong>发布时间：</strong>{currentItem.createTime}</p>
            <p><strong>认领者：</strong>{currentItem.claimer || '无'}</p>
            <p><strong>发布者联系方式：</strong>{currentItem.contact || '无'}</p>
            <p><strong>线索数：</strong>{currentItem.clueCount || 0}</p>
          </div>
        )}
      </Drawer>

      {/* 编辑抽屉 */}
      <Drawer
        title="编辑物品"
        placement="right"
        width={500}
        onClose={() => setEditVisible(false)}
        open={editVisible}
        extra={
          <Button type="primary" onClick={handleEditSubmit}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { label: '未认领', value: '未认领' },
                { label: '已认领', value: '已认领' },
              ]}
            />
          </Form.Item>
          <Form.Item name="contact" label="联系方式">
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default ItemList
