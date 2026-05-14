import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, message, Popconfirm
} from 'antd'
import {
  CheckOutlined, CloseOutlined, CheckCircleOutlined, StopOutlined
} from '@ant-design/icons'
import { getVerifications, approveVerification, rejectVerification, batchVerify } from '../utils/api'

function StudentVerify() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  useEffect(() => {
    fetchData()
  }, [pagination.current])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getVerifications()
      // 后端直接返回数组，不需要 list/total 结构
      setData(Array.isArray(res.data) ? res.data : [])
      setPagination((prev) => ({ ...prev, total: Array.isArray(res.data) ? res.data.length : 0 }))
    } catch (e) {
      console.error('Failed to fetch verifications:', e)
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
      // 错误已处理
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

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
    },
    {
      title: '真实姓名',
      dataIndex: 'realName',
      width: 120,
    },
    {
      title: '学号',
      dataIndex: 'studentNo',
      width: 150,
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
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
        <h2>学生认证审核</h2>
      </div>

      <div className="table-card">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleBatchApprove}
              disabled={selectedRowKeys.length === 0}
            >
              批量通过
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleBatchReject}
              disabled={selectedRowKeys.length === 0}
            >
              批量拒绝
            </Button>
            <span style={{ color: '#999', marginLeft: 8 }}>
              已选择 {selectedRowKeys.length} 项
            </span>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="username"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          rowSelection={rowSelection}
        />
      </div>

      {data.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          暂无待审核的认证申请
        </div>
      )}
    </div>
  )
}

export default StudentVerify
