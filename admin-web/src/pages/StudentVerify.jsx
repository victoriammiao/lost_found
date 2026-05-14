import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, message, Popconfirm, Select, Empty, Tooltip, Badge
} from 'antd'
import {
  CheckOutlined, CloseOutlined, CheckCircleOutlined, StopOutlined,
  ReloadOutlined, FilterOutlined, SafetyCertificateOutlined
} from '@ant-design/icons'
import { getVerifications, approveVerification, rejectVerification, batchVerify } from '../utils/api'

const STATUS_OPTIONS = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
]

function StudentVerify() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, statusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: statusFilter || '',
      }
      const res = await getVerifications(params)
      // 兼容后端返回的 { list, total, page, pageSize } 结构，
      // 同时兼容老版本直接返回数组的情况
      const payload = res?.data
      let list = []
      let total = 0
      if (Array.isArray(payload)) {
        list = payload
        total = payload.length
      } else if (payload && Array.isArray(payload.list)) {
        list = payload.list
        total = typeof payload.total === 'number' ? payload.total : payload.list.length
      }
      setData(list)
      setPagination((prev) => ({ ...prev, total }))
      // 切换数据后清空已选中
      setSelectedRowKeys([])
    } catch (e) {
      console.error('Failed to fetch verifications:', e)
      setData([])
      setPagination((prev) => ({ ...prev, total: 0 }))
    } finally {
      setLoading(false)
    }
  }

  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
  }

  const handleApprove = async (record) => {
    try {
      await approveVerification(record.username)
      message.success(`已通过 ${record.username} 的认证申请`)
      fetchData()
    } catch (e) {
      // 错误已在请求拦截器中处理
    }
  }

  const handleReject = async (record) => {
    try {
      await rejectVerification(record.username)
      message.success(`已拒绝 ${record.username} 的认证申请`)
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要通过的申请')
      return
    }
    try {
      await batchVerify(selectedRowKeys, 'approve')
      message.success(`已通过 ${selectedRowKeys.length} 条认证申请`)
      setSelectedRowKeys([])
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const handleBatchReject = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要拒绝的申请')
      return
    }
    try {
      await batchVerify(selectedRowKeys, 'reject')
      message.success(`已拒绝 ${selectedRowKeys.length} 条认证申请`)
      setSelectedRowKeys([])
      fetchData()
    } catch (e) {
      // 错误已处理
    }
  }

  const getStatusTag = (status) => {
    const map = {
      pending: { className: 'tag-pending', text: '待审核' },
      approved: { className: 'tag-approved', text: '已通过' },
      rejected: { className: 'tag-rejected', text: '已拒绝' },
    }
    const tag = map[status] || map.pending
    return <Tag className={tag.className}>{tag.text}</Tag>
  }

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 160,
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '真实姓名',
      dataIndex: 'realName',
      width: 120,
      render: (v) => v || <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      width: 160,
      render: (v) => v || <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '认证状态',
      dataIndex: 'studentVerifyStatus',
      width: 120,
      render: (status) => getStatusTag(status),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 200,
      render: (v) => v || <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        // 只对待审核的显示通过/拒绝
        if (record.studentVerifyStatus !== 'pending') {
          return <span style={{ color: '#bbb' }}>已处理</span>
        }
        return (
          <Space size="small">
            <Popconfirm
              title={`确定通过 ${record.username} 的认证申请？`}
              onConfirm={() => handleApprove(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="primary" size="small" icon={<CheckOutlined />}>
                通过
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`确定拒绝 ${record.username} 的认证申请？`}
              onConfirm={() => handleReject(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button danger size="small" icon={<CloseOutlined />}>
                拒绝
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      // 只允许对 pending 状态进行批量审核
      disabled: record.studentVerifyStatus !== 'pending',
    }),
  }

  const showBatchButtons = statusFilter === 'pending' || statusFilter === ''

  return (
    <div>
      <div className="page-header">
        <Space align="center" size={12}>
          <SafetyCertificateOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <h2 style={{ margin: 0 }}>学生认证审核</h2>
          <Badge
            count={pagination.total}
            showZero
            overflowCount={9999}
            style={{ backgroundColor: '#1890ff', marginLeft: 8 }}
          />
          <span style={{ color: '#999', fontSize: 13 }}>
            当前共 {pagination.total} 条申请
          </span>
        </Space>
      </div>

      <div className="filter-bar">
        <Space wrap>
          <span style={{ color: '#666', fontSize: 13 }}>
            <FilterOutlined /> 状态筛选：
          </span>
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v ?? '')
              setPagination((p) => ({ ...p, current: 1 }))
            }}
            style={{ width: 140 }}
            options={STATUS_OPTIONS}
            allowClear
            onClear={() => setStatusFilter('')}
            placeholder="全部"
          />
          <Tooltip title="刷新列表">
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              刷新
            </Button>
          </Tooltip>
        </Space>
      </div>

      <div className="table-card">
        {showBatchButtons && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafbfc',
          }}>
            <Space>
              <Popconfirm
                title={`确定批量通过选中的 ${selectedRowKeys.length} 条申请？`}
                onConfirm={handleBatchApprove}
                disabled={selectedRowKeys.length === 0}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={selectedRowKeys.length === 0}
                >
                  批量通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title={`确定批量拒绝选中的 ${selectedRowKeys.length} 条申请？`}
                onConfirm={handleBatchReject}
                disabled={selectedRowKeys.length === 0}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<StopOutlined />}
                  disabled={selectedRowKeys.length === 0}
                >
                  批量拒绝
                </Button>
              </Popconfirm>
              <span style={{ color: '#999', marginLeft: 8 }}>
                已选择 {selectedRowKeys.length} 项
              </span>
            </Space>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={data}
          rowKey="username"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50'],
          }}
          onChange={handleTableChange}
          rowSelection={showBatchButtons ? rowSelection : undefined}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  statusFilter === 'pending'
                    ? '暂无待审核的认证申请'
                    : '暂无数据'
                }
              />
            ),
          }}
        />
      </div>
    </div>
  )
}

export default StudentVerify
